const emailService = require('./emailService');
const Student = require('../models/Student');
const Porter = require('../models/Porter');
const Admin = require('../models/Admin');
const { normalizeStudentNotificationPreferences, } = require('../constants/studentNotificationPreferences');
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;
const NotificationType = {
    PAYMENT_SUCCESSFUL: 'payment_successful',
    RESERVATION_CONFIRMED: 'reservation_confirmed',
    ROOMMATE_RESERVED: 'roommate_reserved',
    ROOM_ASSIGNMENT_UPDATED: 'room_assignment_updated',
    INVITATION_STATUS_UPDATED: 'invitation_status_updated',
    ADMIN_ANNOUNCEMENT: 'admin_announcement',
    DAILY_RESERVATION_SUMMARY: 'daily_reservation_summary',
    NEW_STUDENT_CHECKIN: 'new_student_checkin',
    PORTER_APPLICATION_PENDING: 'porter_application_pending',
    PORTER_APPROVED: 'porter_approved',
    RESERVATION_EXPIRED: 'reservation_expired',
};
const getStudentDisplayName = (studentLike, fallback = 'A student') => {
    if (!studentLike)
        return fallback;
    const fullName = [studentLike.firstName, studentLike.lastName].filter(Boolean).join(' ').trim();
    return fullName || studentLike.matricNo || fallback;
};
const formatDateTime = (value) => {
    if (!value)
        return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return null;
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};
const getActivePushDevices = (student) => (student?.pushDevices || []).filter((device) => device?.enabled && EXPO_PUSH_TOKEN_PATTERN.test(String(device?.token || '')));
const canSendPushForPreference = (student, preferenceKey) => {
    const preferences = normalizeStudentNotificationPreferences(student?.notificationPreferences);
    return preferences.pushEnabled && preferences[preferenceKey] !== false;
};
const buildExpoPushMessages = (student, payload) => getActivePushDevices(student).map((device) => ({
    to: device.token,
    sound: payload.sound || 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    channelId: payload.channelId || 'stayhub-alerts',
    priority: payload.priority || 'high',
}));
const sendExpoPushMessages = async (messages) => {
    if (!Array.isArray(messages) || messages.length === 0) {
        return { success: false, deliveredCount: 0, tickets: [] };
    }
    try {
        const response = await fetch(EXPO_PUSH_ENDPOINT, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Expo push request failed (${response.status}): ${errorText}`);
        }
        const payload = await response.json();
        const tickets = Array.isArray(payload?.data) ? payload.data : [];
        const deliveredCount = tickets.filter((ticket) => ticket?.status === 'ok').length;
        return {
            success: deliveredCount > 0,
            deliveredCount,
            tickets,
        };
    }
    catch (error) {
        console.error('Error sending Expo push notification:', error);
        return {
            success: false,
            deliveredCount: 0,
            tickets: [],
            error,
        };
    }
};
const deliverStudentNotification = async ({ student, preferenceKey, pushPayload, emailHandler, forceEmail = false, emailOnPushFailure = true, }) => {
    const preferences = normalizeStudentNotificationPreferences(student?.notificationPreferences);
    let pushResult = { success: false, deliveredCount: 0, tickets: [] };
    const pushAttempted = Boolean(pushPayload && canSendPushForPreference(student, preferenceKey));
    if (pushPayload && canSendPushForPreference(student, preferenceKey)) {
        pushResult = await sendExpoPushMessages(buildExpoPushMessages(student, pushPayload));
    }
    const shouldSendEmail = typeof emailHandler === 'function' &&
        (forceEmail || preferences.emailEscalationEnabled || (emailOnPushFailure && !pushResult.success));
    if (shouldSendEmail) {
        await emailHandler();
    }
    return {
        pushAttempted,
        pushDelivered: pushResult.success,
        emailSent: shouldSendEmail,
        pushResult,
    };
};
const buildGenericStudentEmail = ({ title, message, destination, actionLabel = 'Open StayHub' }) => {
    const actionUrl = destination ? `# ${destination}` : null;
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f5f7fb;
            color: #1f2937;
            margin: 0;
            padding: 24px 0;
          }
          .card {
            max-width: 620px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 18px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
          }
          .header {
            background: linear-gradient(135deg, #1565C0, #0d47a1);
            color: #ffffff;
            padding: 28px 32px;
          }
          .body {
            padding: 28px 32px;
          }
          .message {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 18px;
            margin: 20px 0;
            line-height: 1.6;
          }
          .button {
            display: inline-block;
            margin-top: 8px;
            padding: 12px 20px;
            border-radius: 10px;
            background: #1565C0;
            color: #ffffff !important;
            text-decoration: none;
            font-weight: 700;
          }
          .footer {
            padding: 20px 32px 28px;
            color: #64748b;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h2 style="margin: 0; font-size: 24px;">${title}</h2>
          </div>
          <div class="body">
            <p>Hello,</p>
            <div class="message">${message}</div>
            ${actionUrl
        ? `<p>This notice is also available in your StayHub notification center.</p>
                   <a class="button" href="${actionUrl}">${actionLabel}</a>`
        : ''}
          </div>
          <div class="footer">
            StayHub Hostel Management System
          </div>
        </div>
      </body>
    </html>
  `;
};
const sendNotification = async (type, data) => {
    try {
        switch (type) {
            case NotificationType.PAYMENT_SUCCESSFUL:
                return await emailService.sendPaymentConfirmation(data.student, data.payment);
            case NotificationType.RESERVATION_CONFIRMED:
                return await emailService.sendReservationConfirmation(data.student, data.room, data.bunk, data.hostel);
            case NotificationType.ROOMMATE_RESERVED:
                return await emailService.sendRoommateNotification(data.student, data.reservedBy, data.room, data.hostel, data.expiresAt);
            case NotificationType.INVITATION_STATUS_UPDATED:
                return await emailService.sendInvitationStatusUpdate(data.inviter, data.invitee, data.room, data.hostel, data.action, data.notes);
            case NotificationType.PORTER_APPROVED:
                return await emailService.sendPorterWelcomeEmail(data.porter, data.hostel);
            case NotificationType.DAILY_RESERVATION_SUMMARY:
                return await emailService.sendDailyReservationsSummary(data.porter, data.reservations);
            default:
                console.log('Unknown notification type:', type);
                return { success: false, message: 'Unknown notification type' };
        }
    }
    catch (error) {
        console.error('Error sending notification:', error);
        throw error;
    }
};
const notifyPaymentSuccess = async (studentId, payment) => {
    try {
        const student = await Student.findById(studentId);
        if (!student)
            throw new Error('Student not found');
        return await deliverStudentNotification({
            student,
            preferenceKey: 'paymentUpdates',
            pushPayload: {
                title: 'Payment Confirmed',
                body: 'Your hostel payment has been verified successfully.',
                data: {
                    destination: '/student/payment',
                    type: NotificationType.PAYMENT_SUCCESSFUL,
                    reference: payment?.paymentReference || payment?.reference || null,
                },
            },
            emailHandler: () => sendNotification(NotificationType.PAYMENT_SUCCESSFUL, {
                student,
                payment,
            }),
            forceEmail: true,
        });
    }
    catch (error) {
        console.error('Error notifying payment success:', error);
        throw error;
    }
};
const sendPaymentCode = async (studentId, paymentCode, paymentReference) => {
    try {
        const student = await Student.findById(studentId);
        if (!student)
            throw new Error('Student not found');
        const emailService = require('./emailService');
        const subject = `Your Payment Code: ${paymentCode} - StayHub`;
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background-color: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .content { 
            padding: 30px; 
          }
          .code-box { 
            background: #f0f9ff; 
            border: 3px solid #4CAF50; 
            border-radius: 10px;
            padding: 25px; 
            text-align: center; 
            margin: 25px 0; 
          }
          .code { 
            font-size: 42px; 
            font-weight: bold; 
            letter-spacing: 12px; 
            color: #4CAF50; 
            font-family: 'Courier New', monospace;
            margin: 15px 0;
          }
          .info-box { 
            background: #e8f5e9; 
            padding: 20px; 
            border-left: 5px solid #4CAF50; 
            margin: 20px 0; 
            border-radius: 5px;
          }
          .warning-box {
            background: #fff3e0;
            padding: 20px;
            border-left: 5px solid #ff9800;
            margin: 20px 0;
            border-radius: 5px;
          }
          .steps {
            background: #f9f9f9;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .steps ol {
            margin: 10px 0;
            padding-left: 20px;
          }
          .steps li {
            margin: 10px 0;
            line-height: 1.8;
          }
          .footer { 
            text-align: center; 
            color: #666; 
            font-size: 13px; 
            padding: 20px;
            background: #f9f9f9;
            border-top: 1px solid #e0e0e0;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 15px 0;
            font-weight: bold;
          }
          strong { color: #2c5f2d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏠 StayHub Payment Code</h1>
          </div>
          
          <div class="content">
            <h2 style="color: #4CAF50; margin-top: 0;">Hello ${student.firstName}!</h2>
            
            <p>Your hostel payment has been initialized successfully. Here's your verification code:</p>
            
            <div class="code-box">
              <p style="margin: 0; color: #666; font-size: 14px;">Your Verification Code</p>
              <div class="code">${paymentCode}</div>
              <p style="margin: 5px 0 0 0; color: #888; font-size: 12px;">Keep this code safe</p>
            </div>

            <div class="info-box">
              <strong>📋 Payment Details:</strong><br>
              <strong>Reference:</strong> ${paymentReference}<br>
              <strong>Student:</strong> ${student.firstName} ${student.lastName}<br>
              <strong>Matric No:</strong> ${student.matricNo}<br>
              <strong>Date:</strong> ${new Date().toLocaleString('en-US', {
            dateStyle: 'long',
            timeStyle: 'short'
        })}
            </div>

            <div class="steps">
              <strong style="font-size: 16px;">📝 How to Complete Payment:</strong>
              <ol>
                <li><strong>Complete Payment:</strong> Click the Paystack payment link to pay your hostel fees</li>
                <li><strong>Return to StayHub:</strong> After successful payment, you'll be redirected back</li>
                <li><strong>Enter Code:</strong> Input the verification code above (${paymentCode})</li>
                <li><strong>Get Verified:</strong> Your payment will be verified instantly!</li>
                <li><strong>Reserve Room:</strong> Proceed to select and reserve your hostel room</li>
              </ol>
            </div>

            <div class="warning-box">
              <strong>⚠️ Important Notes:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>This code is valid for <strong>24 hours</strong></li>
                <li>Keep this code <strong>confidential</strong> - don't share with anyone</li>
                <li>You must <strong>complete payment first</strong> before verification</li>
                <li>Check your spam folder if you can't find this email</li>
              </ul>
            </div>

            <p style="margin-top: 25px;">If you didn't initiate this payment, please ignore this email or contact our support team immediately.</p>
            
            <p style="margin-top: 20px; color: #666;">
              Need help? Contact us at <a href="mailto:support@stayhub.com" style="color: #4CAF50;">support@stayhub.com</a>
            </p>
          </div>

          <div class="footer">
            <p style="margin: 5px 0;"><strong>StayHub - Smart Hostel Management</strong></p>
            <p style="margin: 5px 0;">This is an automated email. Please do not reply.</p>
            <p style="margin: 5px 0; color: #999;">&copy; ${new Date().getFullYear()} StayHub. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
        await emailService.sendEmail({
            to: student.email,
            subject: subject,
            html: html
        });
        console.log(`✅ Payment code sent to ${student.email}`);
        return true;
    }
    catch (error) {
        console.error('Error sending payment code:', error);
        throw error;
    }
};
const notifyReservationConfirmed = async (studentId, roomId, bunkId, hostelId) => {
    try {
        const student = await Student.findById(studentId);
        const Room = require('../models/Room');
        const Bunk = require('../models/Bunk');
        const Hostel = require('../models/Hostel');
        const room = await Room.findById(roomId);
        const bunk = await Bunk.findById(bunkId);
        const hostel = await Hostel.findById(hostelId);
        return await deliverStudentNotification({
            student,
            preferenceKey: 'reservationUpdates',
            pushPayload: {
                title: 'Reservation Confirmed',
                body: `Room ${room?.roomNumber || ''}${hostel?.name ? ` in ${hostel.name}` : ''} is now confirmed for you.`.trim(),
                data: {
                    destination: '/student/reservation',
                    type: NotificationType.RESERVATION_CONFIRMED,
                    roomId: room ? String(room._id) : null,
                    hostelId: hostel ? String(hostel._id) : null,
                    bunkId: bunk ? String(bunk._id) : null,
                },
            },
            emailHandler: () => sendNotification(NotificationType.RESERVATION_CONFIRMED, {
                student,
                room,
                bunk,
                hostel,
            }),
            forceEmail: true,
        });
    }
    catch (error) {
        console.error('Error notifying reservation confirmed:', error);
        throw error;
    }
};
const notifyRoommateReserved = async (studentId, reservedById, roomId, hostelId, expiresAt) => {
    try {
        const student = await Student.findById(studentId);
        const reservedBy = await Student.findById(reservedById);
        const Room = require('../models/Room');
        const Hostel = require('../models/Hostel');
        const room = await Room.findById(roomId);
        const hostel = await Hostel.findById(hostelId);
        const inviterName = getStudentDisplayName(reservedBy, 'A friend');
        const location = room?.roomNumber && hostel?.name
            ? `Room ${room.roomNumber} in ${hostel.name}`
            : room?.roomNumber
                ? `Room ${room.roomNumber}`
                : hostel?.name || 'a room';
        const deadline = formatDateTime(expiresAt);
        const body = deadline
            ? `${inviterName} reserved ${location} for you. Approve it before ${deadline}.`
            : `${inviterName} reserved ${location} for you. Review it as soon as possible.`;
        return await deliverStudentNotification({
            student,
            preferenceKey: 'invitationCreated',
            pushPayload: {
                title: 'Room Invitation',
                body,
                data: {
                    destination: '/student/reservation?focus=invitation',
                    type: NotificationType.ROOMMATE_RESERVED,
                    roomId: room ? String(room._id) : null,
                    hostelId: hostel ? String(hostel._id) : null,
                    inviterId: reservedBy ? String(reservedBy._id) : null,
                    expiresAt,
                },
            },
            emailHandler: () => sendNotification(NotificationType.ROOMMATE_RESERVED, {
                student,
                reservedBy,
                room,
                hostel,
                expiresAt,
            }),
        });
    }
    catch (error) {
        console.error('Error notifying roommate reserved:', error);
        throw error;
    }
};
const notifyInvitationStatusUpdated = async (inviterId, inviteeId, roomId, hostelId, action, notes) => {
    try {
        const inviter = await Student.findById(inviterId);
        const invitee = await Student.findById(inviteeId);
        const Room = require('../models/Room');
        const Hostel = require('../models/Hostel');
        const room = roomId ? await Room.findById(roomId) : null;
        const hostel = hostelId ? await Hostel.findById(hostelId) : null;
        if (!inviter || !invitee) {
            return null;
        }
        const inviteeName = getStudentDisplayName(invitee, 'Your friend');
        const location = room?.roomNumber && hostel?.name
            ? `Room ${room.roomNumber} in ${hostel.name}`
            : room?.roomNumber
                ? `Room ${room.roomNumber}`
                : hostel?.name || 'the reserved room';
        const bodyByAction = {
            approved: `${inviteeName} approved the invitation for ${location}.`,
            rejected: `${inviteeName} rejected the invitation for ${location}.`,
            expired: `${inviteeName}'s invitation for ${location} expired and the bed was released.`,
        };
        const titleByAction = {
            approved: 'Invitation Approved',
            rejected: 'Invitation Declined',
            expired: 'Invitation Expired',
        };
        const preferenceKey = action === 'expired' ? 'invitationExpired' : 'invitationUpdates';
        return await deliverStudentNotification({
            student: inviter,
            preferenceKey,
            pushPayload: {
                title: titleByAction[action] || 'Invitation Update',
                body: bodyByAction[action] || notes || 'Your invitation has been updated.',
                data: {
                    destination: '/student/reservation?focus=history',
                    type: NotificationType.INVITATION_STATUS_UPDATED,
                    action,
                    inviteeId: String(invitee._id),
                    roomId: room ? String(room._id) : null,
                    hostelId: hostel ? String(hostel._id) : null,
                    notes: notes || null,
                },
            },
            emailHandler: () => sendNotification(NotificationType.INVITATION_STATUS_UPDATED, {
                inviter,
                invitee,
                room,
                hostel,
                action,
                notes,
            }),
            forceEmail: action === 'expired',
        });
    }
    catch (error) {
        console.error('Error notifying invitation status update:', error);
        throw error;
    }
};
const sendStudentCustomNotification = async (studentOrId, payload = {}) => {
    try {
        const student = typeof studentOrId === 'string' ? await Student.findById(studentOrId) : studentOrId;
        if (!student) {
            throw new Error('Student not found');
        }
        const title = String(payload.title || 'StayHub Update').trim();
        const message = String(payload.message || '').trim();
        const destination = payload.destination || '/student/notifications';
        if (!message) {
            throw new Error('Notification message is required');
        }
        return await deliverStudentNotification({
            student,
            preferenceKey: payload.preferenceKey || 'adminAnnouncements',
            pushPayload: {
                title,
                body: message,
                data: {
                    destination,
                    type: payload.type || NotificationType.ADMIN_ANNOUNCEMENT,
                    source: payload.source || 'admin',
                    campaignId: payload.campaignId ? String(payload.campaignId) : null,
                },
            },
            emailHandler: () => emailService.sendEmail({
                to: student.email,
                subject: payload.emailSubject || `${title} - StayHub`,
                html: buildGenericStudentEmail({
                    title,
                    message,
                    destination,
                    actionLabel: payload.actionLabel || 'Open Notification Center',
                }),
                text: message,
            }),
            forceEmail: Boolean(payload.forceEmail),
            emailOnPushFailure: payload.emailOnPushFailure !== false,
        });
    }
    catch (error) {
        console.error('Error sending custom student notification:', error);
        throw error;
    }
};
const notifyPorterApproved = async (porterId) => {
    try {
        const porter = await Porter.findById(porterId).populate('assignedHostel');
        if (!porter)
            throw new Error('Porter not found');
        return await sendNotification(NotificationType.PORTER_APPROVED, {
            porter,
            hostel: porter.assignedHostel,
        });
    }
    catch (error) {
        console.error('Error notifying porter approved:', error);
        throw error;
    }
};
const sendDailySummaryToPorters = async () => {
    try {
        const porters = await Porter.find({ approved: true, isActive: true }).populate('assignedHostel');
        const promises = porters.map(async (porter) => {
            if (!porter.assignedHostel)
                return;
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
    }
    catch (error) {
        console.error('Error sending daily summary to porters:', error);
        throw error;
    }
};
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
    }
    catch (error) {
        console.error('Error notifying admin:', error);
        throw error;
    }
};
module.exports = {
    NotificationType,
    normalizeStudentNotificationPreferences,
    sendNotification,
    sendStudentCustomNotification,
    notifyPaymentSuccess,
    sendPaymentCode,
    notifyReservationConfirmed,
    notifyRoommateReserved,
    notifyInvitationStatusUpdated,
    notifyPorterApproved,
    sendDailySummaryToPorters,
    notifyAdminNewPorterApplication,
};
