const { formatDateTime } = require('../utils/dateUtils');
const config = require('../config/env');

const renderDetailRows = (rows) => rows
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`)
    .join('');

const renderDetails = (rows) => `
  <table class="details details-card" role="presentation" cellpadding="0" cellspacing="0">
    <tbody>
      ${renderDetailRows(rows)}
    </tbody>
  </table>
`;

const renderButton = (href, label) => `
  <p class="button-row">
    <a href="${href}" class="button">${label}</a>
  </p>
`;

const brandLogo = `
  <span class="logo-mark" aria-hidden="true">
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="stayhubLogoGradient" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stop-color="#14B8A6"/>
          <stop offset="1" stop-color="#0F766E"/>
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="18" fill="url(#stayhubLogoGradient)"/>
      <path d="M19 29.5L32 18L45 29.5" stroke="#F8FAFC" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M23 28.5V45.5H41V28.5" fill="#FFFFFF" fill-opacity="0.12" stroke="#F8FAFC" stroke-width="4" stroke-linejoin="round"/>
      <rect x="28.5" y="34" width="7" height="11.5" rx="2" fill="#FBBF24"/>
      <rect x="25" y="31" width="4.5" height="4.5" rx="1.2" fill="#CCFBF1"/>
      <rect x="34.5" y="31" width="4.5" height="4.5" rx="1.2" fill="#CCFBF1"/>
    </svg>
  </span>
`;

const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 28px 14px;
      background: #f3eadc;
      color: #1f2937;
      font-family: Arial, sans-serif;
      line-height: 1.6;
    }
    .wrapper {
      max-width: 640px;
      margin: 0 auto;
      border-radius: 30px;
      overflow: hidden;
    }
    .hero {
      padding: 26px 32px 28px;
      background:
        radial-gradient(circle at top right, rgba(251, 191, 36, 0.32), transparent 34%),
        radial-gradient(circle at left bottom, rgba(45, 212, 191, 0.18), transparent 36%),
        linear-gradient(135deg, #0b4f4b 0%, #0f766e 46%, #155e75 100%);
      color: #f8fafc;
      border-radius: 28px 28px 0 0;
    }
    .hero-badge {
      display: inline-block;
      margin-bottom: 18px;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(251, 191, 36, 0.18);
      border: 1px solid rgba(251, 191, 36, 0.28);
      color: #fef3c7;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .brand-row {
      font-size: 0;
    }
    .logo-mark {
      display: inline-block;
      width: 64px;
      vertical-align: middle;
    }
    .brand-copy {
      display: inline-block;
      width: 470px;
      max-width: 470px;
      margin-left: 20px;
      vertical-align: middle;
    }
    .brand-kicker {
      margin: 0 0 6px;
      color: rgba(236, 253, 245, 0.86);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .brand-name {
      margin: 0;
      color: #ffffff;
      font-size: 30px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .brand-subtitle {
      margin: 8px 0 0;
      max-width: 420px;
      color: rgba(236, 253, 245, 0.92);
      font-size: 15px;
    }
    .hero-tags {
      margin-top: 18px;
    }
    .hero-tag {
      display: inline-block;
      margin: 0 8px 8px 0;
      padding: 7px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.18);
      color: #f8fafc;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .content-shell {
      margin: -18px 22px 22px;
      background: linear-gradient(180deg, #ffffff 0%, #fffdf8 100%);
      border: 1px solid #e8dece;
      border-radius: 22px;
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.12);
      overflow: hidden;
    }
    .content-accent {
      height: 6px;
      background: linear-gradient(90deg, #0f766e 0%, #14b8a6 48%, #f59e0b 100%);
    }
    .content {
      padding: 30px 30px 32px;
    }
    h2, h3 {
      margin: 0 0 16px;
      color: #111827;
    }
    h2 {
      font-size: 28px;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }
    p, ol, ul {
      margin: 0 0 14px;
    }
    ol, ul {
      padding-left: 20px;
    }
    .details {
      width: 100%;
      margin: 20px 0;
      border-collapse: separate;
      border-spacing: 0;
      border-radius: 16px;
      overflow: hidden;
    }
    .details-card {
      border: 1px solid #d6e6df;
      background: #ffffff;
    }
    .details-card td {
      padding: 12px 14px;
      border-bottom: 1px solid #e7ece7;
      vertical-align: top;
    }
    .details-card tr:last-child td {
      border-bottom: none;
    }
    .details-card td:first-child {
      width: 40%;
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #0f5f5a;
      background: #eef7f4;
    }
    .summary-table {
      border: 1px solid #ebe0cd;
      background: #fffaf2;
    }
    .summary-table thead td {
      padding: 12px 14px;
      background: #f59e0b;
      color: #ffffff;
      font-weight: 700;
    }
    .summary-table tbody td {
      padding: 12px 14px;
      border-bottom: 1px solid #eee6d9;
      background: #ffffff;
    }
    .summary-table tbody tr:nth-child(even) td {
      background: #fffaf4;
    }
    .summary-table tbody tr:last-child td {
      border-bottom: none;
    }
    .button-row {
      margin: 26px 0 22px;
    }
    .button {
      display: inline-block;
      padding: 12px 20px;
      background: linear-gradient(135deg, #0f766e 0%, #155e75 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 999px;
      font-weight: 700;
      box-shadow: 0 12px 28px rgba(15, 118, 110, 0.24);
    }
    .muted {
      color: #6b7280;
      font-size: 14px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 22px;
      border-top: 1px solid #e7ece7;
      color: #6b7280;
      font-size: 13px;
    }
    @media only screen and (max-width: 640px) {
      .hero,
      .content {
        padding-left: 20px;
        padding-right: 20px;
      }
      .content-shell {
        margin-left: 14px;
        margin-right: 14px;
      }
      .brand-copy {
        width: 100%;
        max-width: none;
        margin-left: 12px;
      }
      .brand-name {
        font-size: 26px;
      }
      .brand-subtitle {
        font-size: 14px;
      }
      .details td:first-child {
        width: 42%;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="hero">
      <div class="hero-badge">Official StayHub Update</div>
      <div class="brand-row">
        ${brandLogo}
        <div class="brand-copy">
          <p class="brand-kicker">Student Accommodation Platform</p>
          <p class="brand-name">StayHub</p>
          <p class="brand-subtitle">Clear updates for room reservations, payments, check-in, and campus housing operations.</p>
        </div>
      </div>
      <div class="hero-tags">
        <span class="hero-tag">Reservations</span>
        <span class="hero-tag">Payments</span>
        <span class="hero-tag">Check-In</span>
      </div>
    </div>
    <div class="content-shell">
      <div class="content-accent"></div>
      <div class="content">
        ${content}
        <div class="footer">
          <p>This is an automated email from StayHub.</p>
          <p>&copy; ${new Date().getFullYear()} StayHub. Student accommodation made easier.</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

const paymentConfirmation = (student, payment) => {
    const content = `
    <h2>Payment Successful</h2>
    <p>Dear ${student.firstName} ${student.lastName},</p>
    <p>Your payment has been received successfully.</p>

    ${renderDetails([
        ['Payment Code', payment.paymentCode],
        ['Amount Paid', `N${payment.amount.toLocaleString()}`],
        ['Reference', payment.paymentReference],
        ['Date', formatDateTime(payment.datePaid)],
    ])}

    <p>Please keep your payment code safe. You will need it during room reservation and check-in.</p>
    ${renderButton(`${config.FRONTEND_URL}/student/hostels`, 'Reserve Room')}
    <p class="muted">If you need help, please contact the administrator.</p>
  `;

    return baseTemplate(content);
};

const reservationConfirmation = (student, room, bunk, hostel) => {
    const content = `
    <h2>Reservation Confirmed</h2>
    <p>Dear ${student.firstName} ${student.lastName},</p>
    <p>Your room reservation has been confirmed.</p>

    ${renderDetails([
        ['Hostel', hostel.name],
        ['Room Number', room.roomNumber],
        ['Bunk Number', bunk.bunkNumber],
        ['Level', `${hostel.level} Level`],
    ])}

    <p>Next steps:</p>
    <ol>
      <li>Bring your payment code when checking in.</li>
      <li>Report to the porter when you arrive.</li>
      <li>Present your student ID and payment confirmation.</li>
    </ol>

    ${student.roommates && student.roommates.length > 0
        ? `<p>You reserved this room with ${student.roommates.length} other student(s).</p>`
        : ''}

    ${renderButton(`${config.FRONTEND_URL}/student/reservation?focus=history&source=email`, 'View Reservation')}
  `;

    return baseTemplate(content);
};

const roommateNotification = (student, reservedBy, room, hostel, expiresAt) => {
    const approvalDeadline = expiresAt
        ? formatDateTime(expiresAt)
        : `${config.RESERVATION_EXPIRY_HOURS} hours`;

    const content = `
    <h2>Room Invitation</h2>
    <p>Dear ${student.firstName} ${student.lastName},</p>
    <p>${reservedBy.firstName} ${reservedBy.lastName} reserved a room space for you.</p>

    ${renderDetails([
        ['Hostel', hostel.name],
        ['Room Number', room.roomNumber],
        ['Level', `${hostel.level} Level`],
        ['Reserved By', `${reservedBy.firstName} ${reservedBy.lastName} (${reservedBy.matricNo})`],
        ['Approve Before', approvalDeadline],
    ])}

    <p>Please complete your payment if needed, then review and approve this room before the deadline.</p>
    ${renderButton(`${config.FRONTEND_URL}/student/reservation?focus=invitation&source=email`, 'Review Invitation')}
    <p class="muted">If you reject the invitation or do nothing before the deadline, the room hold will be released automatically.</p>
  `;

    return baseTemplate(content);
};

const invitationStatusUpdate = (inviter, invitee, room, hostel, action, notes) => {
    const actionLabels = {
        approved: 'approved',
        rejected: 'rejected',
        expired: 'expired',
    };

    const actionLabel = actionLabels[action] || action;
    const content = `
    <h2>Invitation Update</h2>
    <p>Dear ${inviter.firstName} ${inviter.lastName},</p>
    <p>${invitee.firstName} ${invitee.lastName} has ${actionLabel} the room invitation.</p>

    ${renderDetails([
        ['Invitee', `${invitee.firstName} ${invitee.lastName} (${invitee.matricNo})`],
        ['Hostel', hostel?.name || 'Assigned hostel'],
        ['Room Number', room?.roomNumber || 'Assigned room'],
        ['Note', notes],
    ])}

    ${renderButton(`${config.FRONTEND_URL}/student/reservation?focus=history&source=email`, 'View Invitation History')}
  `;

    return baseTemplate(content);
};

const passwordReset = (resetUrl) => {
    const content = `
    <h2>Password Reset Request</h2>
    <p>You requested to reset your password.</p>
    <p>Use the link below to choose a new password. This link will expire in 1 hour.</p>

    ${renderButton(resetUrl, 'Reset Password')}
    <p class="muted">If you did not request this, you can ignore this email.</p>
  `;

    return baseTemplate(content);
};

const porterWelcome = (porter, hostel) => {
    const content = `
    <h2>Porter Account Approved</h2>
    <p>Dear ${porter.firstName} ${porter.lastName},</p>
    <p>Your porter application has been approved.</p>

    ${renderDetails([
        ['Assigned Hostel', hostel ? hostel.name : 'Not yet assigned'],
        ['Email', porter.email],
        ['Status', 'Approved'],
    ])}

    <p>Your responsibilities include monitoring student check-ins, verifying payment codes, and reporting issues to the admin team.</p>
    <p>Please change your default password after your first login.</p>
    ${renderButton(`${config.FRONTEND_URL}/porter/login`, 'Login')}
  `;

    return baseTemplate(content);
};

const dailyReservationsSummary = (porter, reservations) => {
    const reservationRows = reservations.map((student) => `
      <tr>
        <td>${student.firstName} ${student.lastName}</td>
        <td>${student.matricNo}</td>
        <td>${student.assignedRoom ? student.assignedRoom.roomNumber : 'N/A'}</td>
        <td>${student.reservationStatus}</td>
      </tr>
    `).join('');

    const reservationTable = reservations.length > 0
        ? `
      <table class="details summary-table" role="presentation" cellpadding="0" cellspacing="0">
        <thead>
          <tr>
            <td><strong>Name</strong></td>
            <td><strong>Matric No</strong></td>
            <td><strong>Room</strong></td>
            <td><strong>Status</strong></td>
          </tr>
        </thead>
        <tbody>
          ${reservationRows}
        </tbody>
      </table>
    `
        : '<p>No new reservations today.</p>';

    const content = `
    <h2>Daily Reservations Summary</h2>
    <p>Dear ${porter.firstName} ${porter.lastName},</p>
    <p>Here is today&apos;s reservation summary for ${porter.assignedHostel ? porter.assignedHostel.name : 'your hostel'}.</p>

    ${renderDetails([
        ['Total New Reservations', reservations.length],
        ['Date', formatDateTime(new Date())],
    ])}

    ${reservationTable}
    ${renderButton(`${config.FRONTEND_URL}/porter/dashboard`, 'View Dashboard')}
  `;

    return baseTemplate(content);
};

const applicationReceived = (firstName) => {
    const content = `
    <h2>Application Received</h2>
    <p>Dear ${firstName},</p>
    <p>Thank you for applying to become a porter at StayHub.</p>
    <p>Your application has been received and is currently under review.</p>

    <p>What happens next:</p>
    <ul>
      <li>Your application will be reviewed by the admin team.</li>
      <li>You will receive an email once a decision has been made.</li>
      <li>If approved, you will be assigned to a hostel.</li>
    </ul>

    <p class="muted">This process usually takes 2 to 3 business days.</p>
  `;

    return baseTemplate(content);
};

module.exports = {
    paymentConfirmation,
    reservationConfirmation,
    roommateNotification,
    invitationStatusUpdate,
    passwordReset,
    porterWelcome,
    dailyReservationsSummary,
    applicationReceived,
};
