const emailService = require('./emailService');
const Student = require('../models/Student');
const Porter = require('../models/Porter');
const Admin = require('../models/Admin');

/**
 * Notification types
 */
const NotificationType = {
  PAYMENT_SUCCESSFUL: 'payment_successful',
  RESERVATION_CONFIRMED: 'reservation_confirmed',
  ROOMMATE_RESERVED: 'roommate_reserved',
  ROOM_ASSIGNMENT_UPDATED: 'room_assignment_updated',
  DAILY_RESERVATION_SUMMARY: 'daily_reservation_summary',
  NEW_STUDENT_CHECKIN: 'new_student_checkin',
  PORTER_APPLICATION_PENDING: 'porter_application_pending',
  PORTER_APPROVED: 'porter_approved',
  RESERVATION_EXPIRED: 'reservation_expired',
};

/**
 * Send notification based on type
 * @param {string} type - Notification type
 * @param {object} data - Notification data
 */
const sendNotification = async (type, data) => {
  try {
    switch (type) {
      case NotificationType.PAYMENT_SUCCESSFUL:
        return await emailService.sendPaymentConfirmation(data.student, data.payment);
      
      case NotificationType.RESERVATION_CONFIRMED:
        return await emailService.sendReservationConfirmation(
          data.student,
          data.room,
          data.bunk,
          data.hostel
        );
      
      case NotificationType.ROOMMATE_RESERVED:
        return await emailService.sendRoommateNotification(
          data.student,
          data.reservedBy,
          data.room,
          data.hostel
        );
      
      case NotificationType.PORTER_APPROVED:
        return await emailService.sendPorterWelcomeEmail(data.porter, data.hostel);
      
      case NotificationType.DAILY_RESERVATION_SUMMARY:
        return await emailService.sendDailyReservationsSummary(data.porter, data.reservations);
      
      default:
        console.log('Unknown notification type:', type);
        return { success: false, message: 'Unknown notification type' };
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

/**
 * Notify student about payment success
 */
const notifyPaymentSuccess = async (studentId, payment) => {
  try {
    const student = await Student.findById(studentId);
    if (!student) throw new Error('Student not found');

    return await sendNotification(NotificationType.PAYMENT_SUCCESSFUL, {
      student,
      payment,
    });
  } catch (error) {
    console.error('Error notifying payment success:', error);
    throw error;
  }
};

/**
 * Notify student about reservation confirmation
 */
const notifyReservationConfirmed = async (studentId, roomId, bunkId, hostelId) => {
  try {
    const student = await Student.findById(studentId);
    const Room = require('../models/Room');
    const Bunk = require('../models/Bunk');
    const Hostel = require('../models/Hostel');
    
    const room = await Room.findById(roomId);
    const bunk = await Bunk.findById(bunkId);
    const hostel = await Hostel.findById(hostelId);

    return await sendNotification(NotificationType.RESERVATION_CONFIRMED, {
      student,
      room,
      bunk,
      hostel,
    });
  } catch (error) {
    console.error('Error notifying reservation confirmed:', error);
    throw error;
  }
};

/**
 * Notify student about being reserved by roommate
 */
const notifyRoommateReserved = async (studentId, reservedById, roomId, hostelId) => {
  try {
    const student = await Student.findById(studentId);
    const reservedBy = await Student.findById(reservedById);
    const Room = require('../models/Room');
    const Hostel = require('../models/Hostel');
    
    const room = await Room.findById(roomId);
    const hostel = await Hostel.findById(hostelId);

    return await sendNotification(NotificationType.ROOMMATE_RESERVED, {
      student,
      reservedBy,
      room,
      hostel,
    });
  } catch (error) {
    console.error('Error notifying roommate reserved:', error);
    throw error;
  }
};

/**
 * Notify porter about approval
 */
const notifyPorterApproved = async (porterId) => {
  try {
    const porter = await Porter.findById(porterId).populate('assignedHostel');
    if (!porter) throw new Error('Porter not found');

    return await sendNotification(NotificationType.PORTER_APPROVED, {
      porter,
      hostel: porter.assignedHostel,
    });
  } catch (error) {
    console.error('Error notifying porter approved:', error);
    throw error;
  }
};

/**
 * Send daily reservations summary to all porters
 */
const sendDailySummaryToPorters = async () => {
  try {
    const porters = await Porter.find({ approved: true, isActive: true }).populate('assignedHostel');
    
    const promises = porters.map(async (porter) => {
      if (!porter.assignedHostel) return;
      
      // Get today's reservations for porter's hostel
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const reservations = await Student.find({
        assignedHostel: porter.assignedHostel._id,
        reservationStatus: { $in: ['temporary', 'confirmed'] },
        updatedAt: { $gte: today },
      }).populate('assignedRoom assignedBunk');

      if (reservations.length > 0) {
        return await sendNotification(NotificationType.DAILY_RESERVATION_SUMMARY, {
          porter,
          reservations,
        });
      }
    });

    return await Promise.allSettled(promises);
  } catch (error) {
    console.error('Error sending daily summary to porters:', error);
    throw error;
  }
};

/**
 * Notify admin about new porter application
 */
const notifyAdminNewPorterApplication = async (porterEmail) => {
  try {
    const admins = await Admin.find({ isActive: true });
    const subject = 'New Porter Application - StayHub';
    const html = `
      <h2>New Porter Application</h2>
      <p>A new porter has submitted an application.</p>
      <p><strong>Email:</strong> ${porterEmail}</p>
      <p>Please review and approve or reject the application from the admin dashboard.</p>
    `;

    const adminEmails = admins.map(admin => admin.email);
    return await emailService.sendBulkEmail(adminEmails, subject, html);
  } catch (error) {
    console.error('Error notifying admin:', error);
    throw error;
  }
};

module.exports = {
  NotificationType,
  sendNotification,
  notifyPaymentSuccess,
  notifyReservationConfirmed,
  notifyRoommateReserved,
  notifyPorterApproved,
  sendDailySummaryToPorters,
  notifyAdminNewPorterApplication,
};
