const { BrevoClient } = require('@getbrevo/brevo');
const config = require('../config/env');

const BREVO_API_KEY_PREFIX = 'xkeysib-';
const BREVO_SMTP_KEY_PREFIX = 'xsmtpsib-';

const parseSender = () => {
    const from = config.EMAIL_FROM || 'StayHub <no-reply@stayhub.local>';
    const match = from.match(/^(.*?)\s*<(.+)>$/);
    if (match) {
        return { name: match[1].trim(), email: match[2].trim() };
    }
    return { name: 'StayHub', email: from.trim() };
};

const sender = parseSender();

const resolveBrevoApiKey = () => {
    const key = String(config.BREVO_API_KEY || '').trim();
    if (!key) {
        throw new Error('BREVO_API_KEY is not configured');
    }

    if (key.startsWith(BREVO_API_KEY_PREFIX)) {
        return key;
    }

    if (key.startsWith(BREVO_SMTP_KEY_PREFIX)) {
        throw new Error('BREVO_API_KEY is using an SMTP key (xsmtpsib). Use a Brevo API key (xkeysib) for Brevo SDK delivery.');
    }

    throw new Error('BREVO_API_KEY appears invalid. Expected a Brevo API key (xkeysib-).');
};

const getBrevoClient = () => new BrevoClient({ apiKey: resolveBrevoApiKey() });

const normalizeRecipients = (to) => {
    if (!to) {
        return [];
    }

    if (Array.isArray(to)) {
        return to.flatMap((recipient) => normalizeRecipients(recipient));
    }

    if (typeof to === 'string') {
        return to
            .split(',')
            .map((email) => email.trim())
            .filter(Boolean)
            .map((email) => ({ email }));
    }

    if (typeof to === 'object' && to.email) {
        return [{ email: to.email, name: to.name }];
    }

    return [];
};

const sendEmail = async (options) => {
    try {
        const recipients = normalizeRecipients(options.to);
        if (recipients.length === 0) {
            throw new Error('No valid recipient email address provided');
        }

        const brevoClient = getBrevoClient();

        const result = await brevoClient.transactionalEmails.sendTransacEmail({
            sender: {
                name: sender.name,
                email: sender.email,
            },
            to: recipients,
            subject: options.subject,
            htmlContent: options.html,
            textContent: options.text,
        });

        const messageId = result?.messageId || result?.messageIds?.[0] || null;
        console.log('Email sent via Brevo:', messageId || 'sent');
        return { success: true, messageId };
    }
    catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};
const sendPaymentConfirmation = async (student, payment) => {
    const html = require('./emailTemplates').paymentConfirmation(student, payment);
    return await sendEmail({
        to: student.email,
        subject: 'Payment Successful - StayHub',
        html,
    });
};
const sendReservationConfirmation = async (student, room, bunk, hostel) => {
    const html = require('./emailTemplates').reservationConfirmation(student, room, bunk, hostel);
    return await sendEmail({
        to: student.email,
        subject: 'Room Reservation Confirmed - StayHub',
        html,
    });
};
const sendRoommateNotification = async (student, reservedBy, room, hostel, expiresAt) => {
    const html = require('./emailTemplates').roommateNotification(student, reservedBy, room, hostel, expiresAt);
    return await sendEmail({
        to: student.email,
        subject: 'Room Invitation Pending Your Approval - StayHub',
        html,
    });
};
const sendInvitationStatusUpdate = async (inviter, invitee, room, hostel, action, notes) => {
    const html = require('./emailTemplates').invitationStatusUpdate(inviter, invitee, room, hostel, action, notes);
    return await sendEmail({
        to: inviter.email,
        subject: `Room Invitation ${String(action).replace('_', ' ')} - StayHub`,
        html,
    });
};
const sendPasswordResetEmail = async (email, resetToken) => {
    const resetUrl = `${config.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const html = require('./emailTemplates').passwordReset(resetUrl);
    return await sendEmail({
        to: email,
        subject: 'Password Reset Request - StayHub',
        html,
    });
};
const sendPorterWelcomeEmail = async (porter, hostel) => {
    const html = require('./emailTemplates').porterWelcome(porter, hostel);
    return await sendEmail({
        to: porter.email,
        subject: 'Welcome to StayHub - Porter Account Approved',
        html,
    });
};
const sendDailyReservationsSummary = async (porter, reservations) => {
    const html = require('./emailTemplates').dailyReservationsSummary(porter, reservations);
    return await sendEmail({
        to: porter.email,
        subject: 'Daily Reservations Summary - StayHub',
        html,
    });
};
const sendApplicationReceivedEmail = async (email, firstName) => {
    const html = require('./emailTemplates').applicationReceived(firstName);
    return await sendEmail({
        to: email,
        subject: 'Porter Application Received - StayHub',
        html,
    });
};
const sendBulkEmail = async (recipients, subject, html) => {
    const promises = recipients.map(recipient => sendEmail({
        to: recipient,
        subject,
        html,
    }));
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
