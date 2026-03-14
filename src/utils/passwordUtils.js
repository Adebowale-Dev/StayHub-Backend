const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};
const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};
const generateRandomPassword = (length = 12) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const values = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        password += charset[values[i] % charset.length];
    }
    return password;
};
const validatePasswordStrength = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isValid = password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers;
    return {
        isValid,
        minLength: password.length >= minLength,
        hasUpperCase,
        hasLowerCase,
        hasNumbers,
        hasSpecialChar,
        message: isValid ? 'Password is strong' : 'Password must be at least 8 characters with uppercase, lowercase, and numbers',
    };
};
const generateDefaultPassword = (firstName) => {
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
};
module.exports = {
    hashPassword,
    comparePassword,
    generateRandomPassword,
    validatePasswordStrength,
    generateDefaultPassword,
};
