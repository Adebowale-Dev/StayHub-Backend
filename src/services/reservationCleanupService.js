const Student = require('../models/Student');
const Room = require('../models/Room');
const Bunk = require('../models/Bunk');
const cacheService = require('./cacheService');
const config = require('../config/env');
const notificationService = require('./notificationService');
const invitationAuditService = require('./invitationAuditService');

let cleanupIntervalHandle = null;

const isInvitationReservation = (student) =>
  student?.reservedBy && String(student.reservedBy?._id || student.reservedBy) !== String(student._id);

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
      await Student.updateMany(
        { _id: { $in: student.roommates.map((roommate) => roommate._id || roommate) } },
        { $pull: { roommates: student._id } }
      );
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
        notificationService.notifyInvitationStatusUpdated(
          inviterId,
          student._id,
          roomId,
          hostelIdValue,
          'expired',
          notes
        ),
      ]);
    }

    student.reservationStatus = 'expired';
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
      const releasedCount = await releaseExpiredReservations();

      if (releasedCount > 0) {
        console.log(`Reservation cleanup released ${releasedCount} expired reservation(s).`);
      }
    } catch (error) {
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
  startReservationCleanupJob,
};
