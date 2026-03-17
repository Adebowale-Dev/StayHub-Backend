const Student = require('../models/Student');
const Room = require('../models/Room');
const Bunk = require('../models/Bunk');
const cacheService = require('./cacheService');
const config = require('../config/env');
const notificationService = require('./notificationService');
const invitationAuditService = require('./invitationAuditService');
let cleanupIntervalHandle = null;
const ACTIVE_RESERVATION_STATUSES = ['temporary', 'confirmed', 'checked_in'];
const isInvitationReservation = (student) => student?.reservedBy && String(student.reservedBy?._id || student.reservedBy) !== String(student._id);
const getEntityId = (entity) => entity?._id || entity || null;
const populateStudentReservationContext = (query) => query
    .populate('assignedHostel assignedRoom assignedBunk reservedBy')
    .populate('roommates', '_id');
const loadStudentReservationContext = async (studentInput) => {
    if (!studentInput) {
        return null;
    }
    if (studentInput?._id && typeof studentInput.save === 'function') {
        return studentInput;
    }
    return populateStudentReservationContext(Student.findById(studentInput));
};
const syncRoomOccupancy = async (roomId) => {
    if (!roomId) {
        return null;
    }
    const room = await Room.findById(roomId);
    if (!room) {
        return null;
    }
    const occupantCount = await Student.countDocuments({
        assignedRoom: roomId,
        reservationStatus: { $in: ACTIVE_RESERVATION_STATUSES },
    });
    room.currentOccupants = occupantCount;
    await room.updateStatus();
    return room;
};
const releaseStudentReservationState = async (studentInput, options = {}) => {
    const student = await loadStudentReservationContext(studentInput);
    if (!student) {
        return null;
    }
    const finalStatus = options.finalStatus || 'none';
    const notes = options.notes || 'Reservation released automatically';
    const shouldNotifyInviter = options.notifyInviter !== false;
    const roomId = getEntityId(student.assignedRoom);
    const hostelId = getEntityId(student.assignedHostel);
    const bunkId = getEntityId(student.assignedBunk);
    const reservedById = getEntityId(student.reservedBy);
    const roommateIds = (student.roommates || []).map((roommate) => getEntityId(roommate)).filter(Boolean);
    const wasInvitationReservation = isInvitationReservation(student);
    if (bunkId) {
        await Bunk.findByIdAndUpdate(bunkId, {
            status: 'available',
            occupiedByStudent: null,
            reservedUntil: null,
        });
    }
    if (roommateIds.length > 0) {
        await Student.updateMany({ _id: { $in: roommateIds } }, { $pull: { roommates: student._id } });
    }
    student.assignedHostel = null;
    student.assignedRoom = null;
    student.assignedBunk = null;
    student.roommates = [];
    student.reservationStatus = finalStatus;
    student.reservedAt = null;
    student.reservationExpiresAt = null;
    student.reservedBy = null;
    student.invitationReminderMarks = [];
    student.checkInDate = finalStatus === 'checked_in' ? student.checkInDate : null;
    await student.save();
    if (roomId) {
        await syncRoomOccupancy(roomId);
    }
    if (shouldNotifyInviter && finalStatus === 'expired' && wasInvitationReservation && reservedById) {
        await Promise.allSettled([
            invitationAuditService.logInvitationOutcome({
                invitee: student,
                inviter: reservedById,
                actor: student._id,
                action: 'expired',
                room: roomId,
                hostel: hostelId,
                bunk: bunkId,
                notes,
            }),
            notificationService.notifyInvitationStatusUpdated(reservedById, student._id, roomId, hostelId, 'expired', notes),
        ]);
    }
    cacheService.del(cacheService.cacheKeys.availableRooms(student.level));
    return student;
};
const reconcileStudentReservationState = async (studentInput, options = {}) => {
    const student = await loadStudentReservationContext(studentInput);
    if (!student) {
        return null;
    }
    const now = options.now ? new Date(options.now) : new Date();
    const roomId = getEntityId(student.assignedRoom);
    const bunkId = getEntityId(student.assignedBunk);
    const hostelId = getEntityId(student.assignedHostel);
    const hasAssignmentState = Boolean(roomId || bunkId || hostelId || (student.roommates || []).length || student.reservationExpiresAt || student.reservedAt || student.reservedBy);
    if (student.reservationStatus === 'checked_in') {
        if (!roomId || !bunkId || !hostelId) {
            return releaseStudentReservationState(student, {
                finalStatus: 'none',
                notifyInviter: false,
                notes: 'Checked-in reservation state was incomplete and has been reset',
            });
        }
        let changed = false;
        if (student.reservationExpiresAt) {
            student.reservationExpiresAt = null;
            changed = true;
        }
        if (bunkId) {
            const bunk = await Bunk.findById(bunkId);
            if (bunk && (bunk.status !== 'occupied' || String(getEntityId(bunk.occupiedByStudent) || '') !== String(student._id) || bunk.reservedUntil)) {
                bunk.status = 'occupied';
                bunk.occupiedByStudent = student._id;
                bunk.reservedUntil = null;
                await bunk.save();
            }
        }
        if (changed) {
            await student.save();
        }
        if (roomId) {
            await syncRoomOccupancy(roomId);
        }
        return student;
    }
    if ((student.reservationStatus === 'temporary' || student.reservationStatus === 'confirmed')
        && student.reservationExpiresAt
        && new Date(student.reservationExpiresAt) <= now) {
        return releaseStudentReservationState(student, {
            finalStatus: 'expired',
            notes: 'Reservation hold expired and was released automatically',
        });
    }
    if ((student.reservationStatus === 'temporary' || student.reservationStatus === 'confirmed')
        && (!roomId || !bunkId || !hostelId)) {
        return releaseStudentReservationState(student, {
            finalStatus: 'none',
            notifyInviter: false,
            notes: 'Reservation state was incomplete and has been reset',
        });
    }
    if (student.reservationStatus === 'expired' && hasAssignmentState) {
        return releaseStudentReservationState(student, {
            finalStatus: 'expired',
            notifyInviter: false,
            notes: 'Expired reservation state was normalized',
        });
    }
    if (student.reservationStatus === 'none' && hasAssignmentState) {
        return releaseStudentReservationState(student, {
            finalStatus: 'none',
            notifyInviter: false,
            notes: 'Stale reservation fields were cleared',
        });
    }
    return student;
};
const getReminderThresholds = () => String(config.INVITATION_REMINDER_HOURS || '12,2')
    .split(',')
    .map((value) => Number(String(value).trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
const getReminderMark = (student, thresholdHours) => {
    const expiryKey = student?.reservationExpiresAt
        ? new Date(student.reservationExpiresAt).toISOString()
        : 'open';
    return `${thresholdHours}:${expiryKey}`;
};
const sendInvitationReminders = async () => {
    const thresholds = getReminderThresholds();
    if (thresholds.length === 0) {
        return 0;
    }
    const now = new Date();
    const pendingInvites = await Student.find({
        reservationStatus: 'temporary',
        reservationExpiresAt: { $gt: now },
    }).populate('assignedHostel assignedRoom reservedBy');
    let sentCount = 0;
    for (const student of pendingInvites) {
        const inviterId = student.reservedBy?._id || student.reservedBy;
        const roomId = student.assignedRoom?._id || student.assignedRoom;
        const hostelId = student.assignedHostel?._id || student.assignedHostel;
        if (!inviterId || !roomId || !hostelId) {
            continue;
        }
        const hoursLeft = (new Date(student.reservationExpiresAt).getTime() - now.getTime()) / (1000 * 60 * 60);
        const marks = Array.isArray(student.invitationReminderMarks) ? student.invitationReminderMarks : [];
        const nextThreshold = thresholds.find((thresholdHours) => hoursLeft <= thresholdHours && !marks.includes(getReminderMark(student, thresholdHours)));
        if (!nextThreshold) {
            continue;
        }
        try {
            await notificationService.notifyInvitationReminder(student._id, inviterId, roomId, hostelId, student.reservationExpiresAt, nextThreshold);
            student.invitationReminderMarks = [...marks, getReminderMark(student, nextThreshold)];
            await student.save();
            sentCount += 1;
        }
        catch (error) {
            console.error(`Failed to send invitation reminder to ${student.matricNo}:`, error);
        }
    }
    return sentCount;
};
const releaseExpiredReservations = async ({ hostelId } = {}) => {
    const query = {
        reservationStatus: { $in: ['temporary', 'confirmed'] },
        reservationExpiresAt: { $lt: new Date() },
    };
    if (hostelId) {
        query.assignedHostel = hostelId;
    }
    const expiredStudents = await populateStudentReservationContext(Student.find(query));
    for (const student of expiredStudents) {
        await releaseStudentReservationState(student, {
            finalStatus: 'expired',
            notes: 'Invitation expired before check-in',
        });
    }
    return expiredStudents.length;
};
const startReservationCleanupJob = () => {
    if (cleanupIntervalHandle) {
        return cleanupIntervalHandle;
    }
    const intervalMinutes = Number(config.INVITATION_CLEANUP_INTERVAL_MINUTES) || 15;
    const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
    cleanupIntervalHandle = setInterval(async () => {
        try {
            const reminderCount = await sendInvitationReminders();
            if (reminderCount > 0) {
                console.log(`Invitation reminder job sent ${reminderCount} reminder(s).`);
            }
            const releasedCount = await releaseExpiredReservations();
            if (releasedCount > 0) {
                console.log(`Reservation cleanup released ${releasedCount} expired reservation(s).`);
            }
        }
        catch (error) {
            console.error('Reservation cleanup job failed:', error);
        }
    }, intervalMs);
    if (typeof cleanupIntervalHandle.unref === 'function') {
        cleanupIntervalHandle.unref();
    }
    console.log(`Reservation cleanup job started. Running every ${intervalMinutes} minute(s).`);
    return cleanupIntervalHandle;
};
module.exports = {
    reconcileStudentReservationState,
    releaseStudentReservationState,
    releaseExpiredReservations,
    sendInvitationReminders,
    startReservationCleanupJob,
};
