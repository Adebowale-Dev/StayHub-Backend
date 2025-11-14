const { formatDateTime } = require('../utils/dateUtils');
const config = require('../config/env');

/**
 * Base email template
 */
const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #2563eb;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 5px 5px 0 0;
    }
    .content {
      background-color: #f9fafb;
      padding: 30px;
      border-radius: 0 0 5px 5px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #2563eb;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
    }
    .info-box {
      background-color: white;
      border-left: 4px solid #2563eb;
      padding: 15px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 14px;
    }
    .highlight {
      background-color: #fef3c7;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>StayHub</h1>
    <p>Smart Hostel Management System</p>
  </div>
  <div class="content">
    ${content}
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} StayHub. All rights reserved.</p>
    <p>This is an automated email. Please do not reply.</p>
  </div>
</body>
</html>
`;

/**
 * Payment confirmation email
 */
const paymentConfirmation = (student, payment) => {
  const content = `
    <h2>Payment Successful! 🎉</h2>
    <p>Dear ${student.firstName} ${student.lastName},</p>
    <p>Your payment has been successfully processed. Here are your payment details:</p>
    
    <div class="info-box">
      <p><strong>Payment Code:</strong> <span class="highlight">${payment.paymentCode}</span></p>
      <p><strong>Amount Paid:</strong> ₦${payment.amount.toLocaleString()}</p>
      <p><strong>Reference:</strong> ${payment.paymentReference}</p>
      <p><strong>Date:</strong> ${formatDateTime(payment.datePaid)}</p>
    </div>
    
    <p><strong>Important:</strong> Please keep your payment code safe. You will need it for room reservation and check-in.</p>
    
    <p>You can now proceed to reserve your hostel room.</p>
    
    <a href="${config.FRONTEND_URL}/student/hostels" class="button">Reserve Room Now</a>
    
    <p>If you have any questions, please contact support.</p>
    
    <p>Best regards,<br>StayHub Team</p>
  `;
  
  return baseTemplate(content);
};

/**
 * Reservation confirmation email
 */
const reservationConfirmation = (student, room, bunk, hostel) => {
  const content = `
    <h2>Room Reservation Confirmed! 🏠</h2>
    <p>Dear ${student.firstName} ${student.lastName},</p>
    <p>Your room reservation has been confirmed. Here are your accommodation details:</p>
    
    <div class="info-box">
      <p><strong>Hostel:</strong> ${hostel.name}</p>
      <p><strong>Room Number:</strong> ${room.roomNumber}</p>
      <p><strong>Bunk Number:</strong> ${bunk.bunkNumber}</p>
      <p><strong>Level:</strong> ${hostel.level} Level</p>
    </div>
    
    <p><strong>Next Steps:</strong></p>
    <ol>
      <li>Bring your payment code when checking in</li>
      <li>Report to the porter upon arrival</li>
      <li>Present your student ID and payment confirmation</li>
    </ol>
    
    ${student.roommates && student.roommates.length > 0 ? `
      <p><strong>Roommates:</strong> You have reserved this room with ${student.roommates.length} other student(s).</p>
    ` : ''}
    
    <a href="${config.FRONTEND_URL}/student/reservations" class="button">View Reservation</a>
    
    <p>Best regards,<br>StayHub Team</p>
  `;
  
  return baseTemplate(content);
};

/**
 * Roommate notification email
 */
const roommateNotification = (student, reservedBy, room, hostel) => {
  const content = `
    <h2>Room Reserved for You! 👥</h2>
    <p>Dear ${student.firstName} ${student.lastName},</p>
    <p><strong>${reservedBy.firstName} ${reservedBy.lastName}</strong> has reserved a room for you as a roommate.</p>
    
    <div class="info-box">
      <p><strong>Hostel:</strong> ${hostel.name}</p>
      <p><strong>Room Number:</strong> ${room.roomNumber}</p>
      <p><strong>Level:</strong> ${hostel.level} Level</p>
      <p><strong>Reserved By:</strong> ${reservedBy.firstName} ${reservedBy.lastName} (${reservedBy.matricNo})</p>
    </div>
    
    <p><strong>Action Required:</strong></p>
    <p>You need to complete your payment and confirm this reservation. If you do not confirm within the specified time, the reservation will expire and you can choose another room.</p>
    
    <a href="${config.FRONTEND_URL}/student/dashboard" class="button">View Details & Confirm</a>
    
    <p>Alternatively, you can choose a different available room if you prefer.</p>
    
    <p>Best regards,<br>StayHub Team</p>
  `;
  
  return baseTemplate(content);
};

/**
 * Password reset email
 */
const passwordReset = (resetUrl) => {
  const content = `
    <h2>Password Reset Request</h2>
    <p>You requested to reset your password.</p>
    <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
    
    <a href="${resetUrl}" class="button">Reset Password</a>
    
    <p>If you didn't request this, please ignore this email.</p>
    
    <p>Best regards,<br>StayHub Team</p>
  `;
  
  return baseTemplate(content);
};

/**
 * Porter welcome email
 */
const porterWelcome = (porter, hostel) => {
  const content = `
    <h2>Welcome to StayHub! 👋</h2>
    <p>Dear ${porter.firstName} ${porter.lastName},</p>
    <p>Your porter application has been approved. Welcome to the StayHub team!</p>
    
    <div class="info-box">
      <p><strong>Assigned Hostel:</strong> ${hostel ? hostel.name : 'Not yet assigned'}</p>
      <p><strong>Email:</strong> ${porter.email}</p>
      <p><strong>Status:</strong> Approved</p>
    </div>
    
    <p><strong>Your Responsibilities:</strong></p>
    <ul>
      <li>Monitor student check-ins at your assigned hostel</li>
      <li>Verify payment codes and student IDs</li>
      <li>Update room occupancy status</li>
      <li>Report any issues to administration</li>
    </ul>
    
    <p><strong>Important:</strong> Please change your default password on first login for security.</p>
    
    <a href="${config.FRONTEND_URL}/porter/login" class="button">Login Now</a>
    
    <p>Best regards,<br>StayHub Team</p>
  `;
  
  return baseTemplate(content);
};

/**
 * Daily reservations summary email for porter
 */
const dailyReservationsSummary = (porter, reservations) => {
  const content = `
    <h2>Daily Reservations Summary 📋</h2>
    <p>Dear ${porter.firstName} ${porter.lastName},</p>
    <p>Here is today's reservations summary for ${porter.assignedHostel ? porter.assignedHostel.name : 'your hostel'}:</p>
    
    <div class="info-box">
      <p><strong>Total New Reservations:</strong> ${reservations.length}</p>
      <p><strong>Date:</strong> ${formatDateTime(new Date())}</p>
    </div>
    
    ${reservations.length > 0 ? `
      <h3>Student Details:</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 10px; text-align: left; border: 1px solid #e5e7eb;">Name</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #e5e7eb;">Matric No</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #e5e7eb;">Room</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #e5e7eb;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${reservations.map(student => `
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${student.firstName} ${student.lastName}</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${student.matricNo}</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${student.assignedRoom ? student.assignedRoom.roomNumber : 'N/A'}</td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">${student.reservationStatus}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p>No new reservations today.</p>'}
    
    <a href="${config.FRONTEND_URL}/porter/dashboard" class="button">View Dashboard</a>
    
    <p>Best regards,<br>StayHub Team</p>
  `;
  
  return baseTemplate(content);
};

/**
 * Application received email
 */
const applicationReceived = (firstName) => {
  const content = `
    <h2>Application Received! ✅</h2>
    <p>Dear ${firstName},</p>
    <p>Thank you for applying to become a porter at StayHub.</p>
    
    <p>Your application has been received and is currently under review. We will notify you once a decision has been made.</p>
    
    <p><strong>What happens next?</strong></p>
    <ul>
      <li>Admin will review your application</li>
      <li>You will receive an email notification with the decision</li>
      <li>If approved, you will be assigned to a hostel</li>
      <li>You can then login and start managing your hostel</li>
    </ul>
    
    <p>This process typically takes 2-3 business days.</p>
    
    <p>Best regards,<br>StayHub Team</p>
  `;
  
  return baseTemplate(content);
};

module.exports = {
  paymentConfirmation,
  reservationConfirmation,
  roommateNotification,
  passwordReset,
  porterWelcome,
  dailyReservationsSummary,
  applicationReceived,
};
