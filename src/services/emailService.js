const nodemailer = require('nodemailer');
const config = require('../config/env');

// Create transporter
const transporter = nodemailer.createTransport({
  host: config.EMAIL_HOST,
  port: config.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: config.EMAIL_USER,
    pass: config.EMAIL_PASSWORD,
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
    const mailOptions = {
      from: config.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

/**
 * Send payment confirmation email
 */
const sendPaymentConfirmation = async (student, payment) => {
  const { formatDateTime } = require('../utils/dateUtils');
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
const sendRoommateNotification = async (student, reservedBy, room, hostel) => {
  const html = require('./emailTemplates').roommateNotification(student, reservedBy, room, hostel);
  
  return await sendEmail({
    to: student.email,
    subject: 'Room Reserved for You - StayHub',
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
  sendPasswordResetEmail,
  sendPorterWelcomeEmail,
  sendDailyReservationsSummary,
  sendApplicationReceivedEmail,
  sendBulkEmail,
};
