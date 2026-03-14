const crypto = require('crypto');
const generateNumericCode = (length = 6) => {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
};
const generateAlphanumericCode = (length = 8) => {
    return crypto.randomBytes(length).toString('hex').slice(0, length).toUpperCase();
};
const generateReference = (prefix = 'REF') => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
};
const generatePaymentCode = () => {
    return generateNumericCode(6);
};
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
