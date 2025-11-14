const crypto = require('crypto');

/**
 * Generate a random numeric code of specified length
 * @param {number} length - Length of the code to generate
 * @returns {string} - Generated code
 */
const generateNumericCode = (length = 6) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
};

/**
 * Generate a random alphanumeric code
 * @param {number} length - Length of the code
 * @returns {string} - Generated code
 */
const generateAlphanumericCode = (length = 8) => {
  return crypto.randomBytes(length).toString('hex').slice(0, length).toUpperCase();
};

/**
 * Generate a unique reference code with prefix
 * @param {string} prefix - Prefix for the reference
 * @returns {string} - Generated reference
 */
const generateReference = (prefix = 'REF') => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

/**
 * Generate a payment code (6-digit numeric)
 * @returns {string} - 6-digit payment code
 */
const generatePaymentCode = () => {
  return generateNumericCode(6);
};

/**
 * Generate a password reset token
 * @returns {string} - Reset token
 */
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = {
  generateNumericCode,
  generateAlphanumericCode,
  generateReference,
  generatePaymentCode,
  generateResetToken,
};
