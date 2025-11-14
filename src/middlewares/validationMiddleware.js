const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
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

/**
 * Validation rules for login
 */
const validateLogin = [
  body('identifier')
    .notEmpty()
    .withMessage('Email or matric number is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors,
];

/**
 * Validation rules for student creation
 */
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
    .isIn([100, 200, 300, 400, 500])
    .withMessage('Level must be 100, 200, 300, 400, or 500'),
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

/**
 * Validation rules for college
 */
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

/**
 * Validation rules for department
 */
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
    .withMessage('Available levels must be an array'),
  body('hodEmail')
    .optional()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  handleValidationErrors,
];

/**
 * Validation rules for hostel
 */
const validateHostel = [
  body('name')
    .notEmpty()
    .withMessage('Hostel name is required')
    .trim(),
  body('level')
    .isIn([100, 200, 300, 400, 500])
    .withMessage('Level must be 100, 200, 300, 400, or 500'),
  body('totalRooms')
    .isInt({ min: 1 })
    .withMessage('Total rooms must be at least 1'),
  handleValidationErrors,
];

/**
 * Validation rules for room
 */
const validateRoom = [
  body('roomNumber')
    .notEmpty()
    .withMessage('Room number is required')
    .trim(),
  body('capacity')
    .isInt({ min: 2 })
    .withMessage('Capacity must be at least 2'),
  body('level')
    .isIn([100, 200, 300, 400, 500])
    .withMessage('Level must be 100, 200, 300, 400, or 500'),
  body('hostel')
    .notEmpty()
    .withMessage('Hostel is required')
    .isMongoId()
    .withMessage('Invalid hostel ID'),
  handleValidationErrors,
];

/**
 * Validation rules for porter application
 */
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

/**
 * Validation rules for room reservation
 */
const validateReservation = [
  body('roomId')
    .notEmpty()
    .withMessage('Room ID is required')
    .isMongoId()
    .withMessage('Invalid room ID'),
  body('bunkId')
    .notEmpty()
    .withMessage('Bunk ID is required')
    .isMongoId()
    .withMessage('Invalid bunk ID'),
  body('roommates')
    .optional()
    .isArray()
    .withMessage('Roommates must be an array'),
  handleValidationErrors,
];

/**
 * Validation rules for password change
 */
const validatePasswordChange = [
  body('oldPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords do not match'),
  handleValidationErrors,
];

/**
 * Validation rules for MongoDB ID
 */
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
