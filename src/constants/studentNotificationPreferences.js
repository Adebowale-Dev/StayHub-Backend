const DEFAULT_STUDENT_NOTIFICATION_PREFERENCES = Object.freeze({
  pushEnabled: true,
  emailEscalationEnabled: true,
  adminAnnouncements: true,
  invitationCreated: true,
  invitationUpdates: true,
  invitationExpired: true,
  paymentUpdates: true,
  reservationUpdates: true,
});

const normalizeStudentNotificationPreferences = (preferences = {}) => {
  const normalized = { ...DEFAULT_STUDENT_NOTIFICATION_PREFERENCES };

  Object.keys(DEFAULT_STUDENT_NOTIFICATION_PREFERENCES).forEach((key) => {
    if (typeof preferences?.[key] === 'boolean') {
      normalized[key] = preferences[key];
    }
  });

  return normalized;
};

module.exports = {
  DEFAULT_STUDENT_NOTIFICATION_PREFERENCES,
  normalizeStudentNotificationPreferences,
};
