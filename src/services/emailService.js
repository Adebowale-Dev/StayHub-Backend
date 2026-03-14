const nodemailer = require('nodemailer');
const config = require('../config/env');

// Parse sender name and email from EMAIL_FROM (format: "Name <email>")
const parseSender = () => {
  const from = config.EMAIL_FROM || 'StayHub <adebowale235@gmail.com>';
  const match = from.match(/^(.*?)\s*<(.+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: 'StayHub', email: from.trim() };
};

const sender = parseSender();

// Initialize Nodemailer transporter with Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.GMAIL_USER,
    pass: config.GMAIL_APP_PASSWORD,
  },
});

/**
 * Send email
 * @param {object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @param {string} options.text - Email text content
 */
const sendEmail = async (options) => {
  try {
    const result = await transporter.sendMail({
      from: `"${sender.name}" <${sender.email}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    console.log('Email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

/**
 * Send payment confirmation email
 */
const sendPaymentConfirmation = async (student, payment) => {
  const html = require('./emailTemplates').paymentConfirmation(student, payment);

  return await sendEmail({
    to: student.email,
    subject: 'Payment Successful - StayHub',
    html,
  });
};

/**
 * Send reservation confirmation email
 */
const sendReservationConfirmation = async (student, room, bunk, hostel) => {
  const html = require('./emailTemplates').reservationConfirmation(student, room, bunk, hostel);

  return await sendEmail({
    to: student.email,
    subject: 'Room Reservation Confirmed - StayHub',
    html,
  });
};

/**
 * Send roommate notification email
 */
const sendRoommateNotification = async (student, reservedBy, room, hostel, expiresAt) => {
  const html = require('./emailTemplates').roommateNotification(student, reservedBy, room, hostel, expiresAt);

  return await sendEmail({
    to: student.email,
    subject: 'Room Invitation Pending Your Approval - StayHub',
    html,
  });
};

/**
 * Send invitation status update email to inviter
 */
const sendInvitationStatusUpdate = async (inviter, invitee, room, hostel, action, notes) => {
  const html = require('./emailTemplates').invitationStatusUpdate(
    inviter,
    invitee,
    room,
    hostel,
    action,
    notes
  );

  return await sendEmail({
    to: inviter.email,
    subject: `Room Invitation ${String(action).replace('_', ' ')} - StayHub`,
    html,
  });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${config.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const html = require('./emailTemplates').passwordReset(resetUrl);

  return await sendEmail({
    to: email,
    subject: 'Password Reset Request - StayHub',
    html,
  });
};

/**
 * Send welcome email to porter
 */
const sendPorterWelcomeEmail = async (porter, hostel) => {
  const html = require('./emailTemplates').porterWelcome(porter, hostel);

  return await sendEmail({
    to: porter.email,
    subject: 'Welcome to StayHub - Porter Account Approved',
    html,
  });
};

/**
 * Send daily reservations summary to porter
 */
const sendDailyReservationsSummary = async (porter, reservations) => {
  const html = require('./emailTemplates').dailyReservationsSummary(porter, reservations);

  return await sendEmail({
    to: porter.email,
    subject: 'Daily Reservations Summary - StayHub',
    html,
  });
};

/**
 * Send application received email
 */
const sendApplicationReceivedEmail = async (email, firstName) => {
  const html = require('./emailTemplates').applicationReceived(firstName);

  return await sendEmail({
    to: email,
    subject: 'Porter Application Received - StayHub',
    html,
  });
};

/**
 * Send bulk email
 */
const sendBulkEmail = async (recipients, subject, html) => {
  const promises = recipients.map(recipient =>
    sendEmail({
      to: recipient,
      subject,
      html,
    })
  );

  return await Promise.allSettled(promises);
};

module.exports = {
  sendEmail,
  sendPaymentConfirmation,
  sendReservationConfirmation,
  sendRoommateNotification,
  sendInvitationStatusUpdate,
  sendPasswordResetEmail,
  sendPorterWelcomeEmail,
  sendDailyReservationsSummary,
  sendApplicationReceivedEmail,
  sendBulkEmail,
};
