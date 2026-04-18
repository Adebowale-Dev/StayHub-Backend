const { body, param, query, validationResult } = require('express-validator');

const ALLOWED_LEVELS = [100, 200, 300, 400, 500, 600];

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array(),
        });
    }
    next();
};
const validateLogin = [
    body('identifier').custom((value, { req }) => {
        if (!value && !req.body.matricNumber) {
            throw new Error('Email or matric number is required');
        }
        return true;
    }),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    handleValidationErrors,
];
const validateStudent = [
    body('firstName')
        .notEmpty()
        .withMessage('First name is required')
        .trim(),
    body('lastName')
        .notEmpty()
        .withMessage('Last name is required')
        .trim(),
    body('matricNo')
        .notEmpty()
        .withMessage('Matric number is required')
        .trim()
        .toUpperCase(),
    body('email')
        .isEmail()
        .withMessage('Valid email is required')
        .normalizeEmail(),
    body('level')
        .isIn(ALLOWED_LEVELS)
        .withMessage('Level must be 100, 200, 300, 400, 500, or 600'),
    body('gender')
        .notEmpty()
        .withMessage('Gender is required')
        .isIn(['male', 'female'])
        .withMessage('Gender must be either male or female')
        .toLowerCase(),
    body('college')
        .notEmpty()
        .withMessage('College is required')
        .isMongoId()
        .withMessage('Invalid college ID'),
    body('department')
        .notEmpty()
        .withMessage('Department is required')
        .isMongoId()
        .withMessage('Invalid department ID'),
    handleValidationErrors,
];
const validateCollege = [
    body('name')
        .notEmpty()
        .withMessage('College name is required')
        .trim(),
    body('code')
        .notEmpty()
        .withMessage('College code is required')
        .trim()
        .toUpperCase(),
    body('deanEmail')
        .optional()
        .isEmail()
        .withMessage('Valid email is required')
        .normalizeEmail(),
    handleValidationErrors,
];
const validateDepartment = [
    body('name')
        .notEmpty()
        .withMessage('Department name is required')
        .trim(),
    body('code')
        .notEmpty()
        .withMessage('Department code is required')
        .trim()
        .toUpperCase(),
    body('college')
        .notEmpty()
        .withMessage('College is required')
        .isMongoId()
        .withMessage('Invalid college ID'),
    body('availableLevels')
        .optional()
        .isArray()
        .withMessage('Available levels must be an array')
        .custom((levels) => {
        if (!Array.isArray(levels)) {
            return true;
        }
        const hasInvalidLevel = levels.some((level) => !ALLOWED_LEVELS.includes(Number(level)));
        if (hasInvalidLevel) {
            throw new Error('Available levels must only include 100, 200, 300, 400, 500, or 600');
        }
        return true;
    }),
    body('hodEmail')
        .optional()
        .isEmail()
        .withMessage('Valid email is required')
        .normalizeEmail(),
    handleValidationErrors,
];
const validateHostel = [
    body('name')
        .notEmpty()
        .withMessage('Hostel name is required')
        .trim(),
    body('level')
        .isIn(ALLOWED_LEVELS)
        .withMessage('Level must be 100, 200, 300, 400, 500, or 600'),
    body('gender')
        .notEmpty()
        .withMessage('Gender is required')
        .isIn(['male', 'female', 'mixed'])
        .withMessage('Gender must be male, female, or mixed')
        .toLowerCase(),
    body('totalRooms')
        .isInt({ min: 1 })
        .withMessage('Total rooms must be at least 1'),
    handleValidationErrors,
];
const validateRoom = [
    body('roomNumber')
        .notEmpty()
        .withMessage('Room number is required')
        .trim(),
    body('capacity')
        .isInt({ min: 2 })
        .withMessage('Capacity must be at least 2'),
    body('level')
        .isIn(ALLOWED_LEVELS)
        .withMessage('Level must be 100, 200, 300, 400, 500, or 600'),
    body('hostel')
        .notEmpty()
        .withMessage('Hostel is required')
        .isMongoId()
        .withMessage('Invalid hostel ID'),
    handleValidationErrors,
];
const validatePorterApplication = [
    body('firstName')
        .notEmpty()
        .withMessage('First name is required')
        .trim(),
    body('lastName')
        .notEmpty()
        .withMessage('Last name is required')
        .trim(),
    body('email')
        .isEmail()
        .withMessage('Valid email is required')
        .normalizeEmail(),
    body('phone')
        .optional()
        .trim(),
    handleValidationErrors,
];
const validateReservation = [
    body('roomId')
        .notEmpty()
        .withMessage('Room ID is required')
        .isMongoId()
        .withMessage('Invalid room ID'),
    body('bunkId')
        .optional()
        .isMongoId()
        .withMessage('Invalid bunk ID'),
    body('roommates')
        .optional()
        .isArray()
        .withMessage('Roommates must be an array'),
    handleValidationErrors,
];
const validatePasswordChange = [
    body().custom((value, { req }) => {
        if (!req.body.oldPassword && !req.body.currentPassword) {
            throw new Error('Current password is required');
        }
        return true;
    }),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain uppercase, lowercase, and number'),
    body('confirmPassword')
        .optional()
        .custom((value, { req }) => value === req.body.newPassword)
        .withMessage('Passwords do not match'),
    handleValidationErrors,
];
const validateMongoId = (paramName) => [
    param(paramName)
        .isMongoId()
        .withMessage(`Invalid ${paramName}`),
    handleValidationErrors,
];
module.exports = {
    handleValidationErrors,
    validateLogin,
    validateStudent,
    validateCollege,
    validateDepartment,
    validateHostel,
    validateRoom,
    validatePorterApplication,
    validateReservation,
    validatePasswordChange,
    validateMongoId,
};
