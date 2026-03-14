const Student = require('../models/Student');
const Room = require('../models/Room');
const Bunk = require('../models/Bunk');
const cacheService = require('./cacheService');
const config = require('../config/env');
const notificationService = require('./notificationService');
const invitationAuditService = require('./invitationAuditService');
let cleanupIntervalHandle = null;
const isInvitationReservation = (student) => student?.reservedBy && String(student.reservedBy?._id || student.reservedBy) !== String(student._id);
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
    const expiredStudents = await Student.find(query)
        .populate('assignedHostel assignedRoom assignedBunk reservedBy')
        .populate('roommates', '_id');
    for (const student of expiredStudents) {
        const roomId = student.assignedRoom?._id || student.assignedRoom;
        const hostelIdValue = student.assignedHostel?._id || student.assignedHostel;
        const bunkId = student.assignedBunk?._id || student.assignedBunk;
        if (bunkId) {
            await Bunk.findByIdAndUpdate(bunkId, {
                status: 'available',
                occupiedByStudent: null,
                reservedUntil: null,
            });
        }
        if (roomId) {
            const room = await Room.findById(roomId);
            if (room) {
                room.currentOccupants = Math.max(0, room.currentOccupants - 1);
                await room.updateStatus();
            }
        }
        if (student.roommates?.length) {
            await Student.updateMany({ _id: { $in: student.roommates.map((roommate) => roommate._id || roommate) } }, { $pull: { roommates: student._id } });
        }
        if (isInvitationReservation(student)) {
            const notes = 'Invitation expired before check-in';
            const inviterId = student.reservedBy?._id || student.reservedBy;
            await Promise.allSettled([
                invitationAuditService.logInvitationOutcome({
                    invitee: student,
                    inviter: inviterId,
                    actor: student._id,
                    action: 'expired',
                    room: student.assignedRoom,
                    hostel: student.assignedHostel,
                    bunk: student.assignedBunk,
                    notes,
                }),
                notificationService.notifyInvitationStatusUpdated(inviterId, student._id, roomId, hostelIdValue, 'expired', notes),
            ]);
        }
        student.reservationStatus = 'expired';
        student.invitationReminderMarks = [];
        await student.save();
        cacheService.del(cacheService.cacheKeys.availableRooms(student.level));
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
    releaseExpiredReservations,
    sendInvitationReminders,
    startReservationCleanupJob,
};
