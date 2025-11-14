const Admin = require('../models/Admin');
const Student = require('../models/Student');
const Porter = require('../models/Porter');
const { generateToken } = require('../middlewares/authMiddleware');
const { generateDefaultPassword } = require('../utils/passwordUtils');
const emailService = require('../services/emailService');

/**
 * @desc    Login for all roles
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    let user, role;

    // Check if identifier is email (admin/porter) or matric number (student)
    const isEmail = identifier.includes('@');

    if (isEmail) {
      // Try admin first
      user = await Admin.findOne({ email: identifier.toLowerCase() });
      if (user) {
        role = 'admin';
      } else {
        // Try porter
        user = await Porter.findOne({ email: identifier.toLowerCase() });
        if (user) {
          role = 'porter';
          // Check if porter is approved
          if (!user.approved) {
            return res.status(403).json({
              success: false,
              message: 'Your application is still pending approval',
            });
          }
        }
      }
    } else {
      // It's a matric number - student login
      user = await Student.findOne({ matricNo: identifier.toUpperCase() });
      if (user) {
        role = 'student';
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact admin.',
      });
    }

    // Verify password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id, role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role,
        firstLogin: user.firstLogin,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
};

/**
 * @desc    Change password
 * @route   POST /api/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = req.user;

    // Verify old password
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Update password
    user.password = newPassword;
    user.firstLogin = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while changing password',
    });
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/profile
 * @access  Private
 */
const getProfile = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user,
      role: req.userRole,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile',
    });
  }
};

/**
 * @desc    Logout
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    // Token-based logout is handled client-side by removing the token
    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout',
    });
  }
};

/**
 * @desc    Forgot password - Send reset email
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email (admin, porter, or student)
    let user = await Admin.findOne({ email: email.toLowerCase() });
    let role = 'admin';

    if (!user) {
      user = await Porter.findOne({ email: email.toLowerCase() });
      role = 'porter';
    }

    if (!user) {
      user = await Student.findOne({ email: email.toLowerCase() });
      role = 'student';
    }

    if (!user) {
      // Don't reveal if email exists
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    }

    // Generate reset token
    const { generateResetToken } = require('../utils/generateCode');
    const resetToken = generateResetToken();

    // Save reset token (in production, store this in database with expiry)
    // For now, we'll send it directly
    
    // Send email
    await emailService.sendPasswordResetEmail(email, resetToken);

    res.status(200).json({
      success: true,
      message: 'Password reset link has been sent to your email',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing request',
    });
  }
};

module.exports = {
  login,
  changePassword,
  getProfile,
  logout,
  forgotPassword,
};
