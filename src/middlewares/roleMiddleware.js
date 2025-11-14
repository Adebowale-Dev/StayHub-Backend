/**
 * Restrict access to specific roles
 * @param  {...string} roles - Allowed roles
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
      });
    }
    next();
  };
};

/**
 * Admin only access
 */
const adminOnly = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access only',
    });
  }
  next();
};

/**
 * Student only access
 */
const studentOnly = (req, res, next) => {
  if (req.userRole !== 'student') {
    return res.status(403).json({
      success: false,
      message: 'Student access only',
    });
  }
  next();
};

/**
 * Porter only access
 */
const porterOnly = (req, res, next) => {
  if (req.userRole !== 'porter') {
    return res.status(403).json({
      success: false,
      message: 'Porter access only',
    });
  }
  next();
};

/**
 * Check if porter is approved
 */
const checkPorterApproval = (req, res, next) => {
  if (req.userRole === 'porter' && !req.user.approved) {
    return res.status(403).json({
      success: false,
      message: 'Your application is still pending approval',
    });
  }
  next();
};

/**
 * Check if porter has assigned hostel
 */
const checkPorterHostel = (req, res, next) => {
  if (req.userRole === 'porter' && !req.user.assignedHostel) {
    return res.status(403).json({
      success: false,
      message: 'No hostel assigned to you yet',
    });
  }
  next();
};

/**
 * Check if student has paid
 */
const checkStudentPayment = (req, res, next) => {
  if (req.userRole === 'student' && req.user.paymentStatus !== 'paid') {
    return res.status(403).json({
      success: false,
      message: 'Payment required to access this resource',
      paymentRequired: true,
    });
  }
  next();
};

/**
 * Verify student level access to hostel
 */
const verifyLevelAccess = async (req, res, next) => {
  if (req.userRole === 'student') {
    const { hostelId } = req.params;
    const Hostel = require('../models/Hostel');
    
    try {
      const hostel = await Hostel.findById(hostelId);
      
      if (!hostel) {
        return res.status(404).json({
          success: false,
          message: 'Hostel not found',
        });
      }
      
      if (hostel.level !== req.user.level) {
        return res.status(403).json({
          success: false,
          message: 'You can only access hostels for your level',
        });
      }
      
      req.hostel = hostel;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error verifying level access',
      });
    }
  } else {
    next();
  }
};

module.exports = {
  restrictTo,
  adminOnly,
  studentOnly,
  porterOnly,
  checkPorterApproval,
  checkPorterHostel,
  checkStudentPayment,
  verifyLevelAccess,
};
