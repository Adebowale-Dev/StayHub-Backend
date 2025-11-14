/**
 * Add hours to a date
 * @param {Date} date - Base date
 * @param {number} hours - Hours to add
 * @returns {Date} - New date
 */
const addHours = (date, hours) => {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
};

/**
 * Add days to a date
 * @param {Date} date - Base date
 * @param {number} days - Days to add
 * @returns {Date} - New date
 */
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Check if date is in the past
 * @param {Date} date - Date to check
 * @returns {boolean} - True if past
 */
const isPast = (date) => {
  return new Date(date) < new Date();
};

/**
 * Check if date is in the future
 * @param {Date} date - Date to check
 * @returns {boolean} - True if future
 */
const isFuture = (date) => {
  return new Date(date) > new Date();
};

/**
 * Format date to readable string
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date
 */
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Format date with time
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date with time
 */
const formatDateTime = (date) => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Get hours difference between two dates
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {number} - Hours difference
 */
const getHoursDifference = (date1, date2) => {
  const diff = Math.abs(new Date(date2) - new Date(date1));
  return Math.floor(diff / (1000 * 60 * 60));
};

/**
 * Get days difference between two dates
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {number} - Days difference
 */
const getDaysDifference = (date1, date2) => {
  const diff = Math.abs(new Date(date2) - new Date(date1));
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

/**
 * Check if a date is expired
 * @param {Date} expiryDate - Expiry date to check
 * @returns {boolean} - True if expired
 */
const isExpired = (expiryDate) => {
  if (!expiryDate) return false;
  return new Date() > new Date(expiryDate);
};

/**
 * Get current academic year
 * @returns {string} - Academic year (e.g., "2023/2024")
 */
const getCurrentAcademicYear = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  // Academic year starts in September (month 8)
  if (currentMonth >= 8) {
    return `${currentYear}/${currentYear + 1}`;
  } else {
    return `${currentYear - 1}/${currentYear}`;
  }
};

/**
 * Get current semester
 * @returns {string} - Semester ("First" or "Second")
 */
const getCurrentSemester = () => {
  const now = new Date();
  const month = now.getMonth();
  
  // First semester: September - January (months 8-0)
  // Second semester: February - June (months 1-5)
  if (month >= 8 || month <= 0) {
    return 'First';
  } else {
    return 'Second';
  }
};

module.exports = {
  addHours,
  addDays,
  isPast,
  isFuture,
  formatDate,
  formatDateTime,
  getHoursDifference,
  getDaysDifference,
  isExpired,
  getCurrentAcademicYear,
  getCurrentSemester,
};
