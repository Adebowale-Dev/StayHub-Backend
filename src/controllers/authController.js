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
    const { password } = req.body;
    const identifier = req.body.identifier || req.body.matricNumber;

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
        } else {
          // Try student by email
          user = await Student.findOne({ email: identifier.toLowerCase() })
            .populate('college', 'name code')
            .populate('department', 'name code');
          if (user) {
            role = 'student';
          }
        }
      }
    } else {
      // It's a matric number - student login
      user = await Student.findOne({ matricNo: identifier.toUpperCase() })
        .populate('college', 'name code')
        .populate('department', 'name code');
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

    // Build user response object
    const userResponse = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role,
      firstLogin: user.firstLogin,
    };

    // Add role-specific fields
    if (role === 'student') {
      userResponse.matricNumber = user.matricNo;
      userResponse.matricNo = user.matricNo;
      userResponse.level = user.level;
      userResponse.gender = user.gender;
      userResponse.phoneNumber = user.phoneNumber;
      userResponse.college = user.college;
      userResponse.department = user.department;
      userResponse.paymentStatus = user.paymentStatus;
      userResponse.reservationStatus = user.reservationStatus;
    } else if (role === 'porter') {
      userResponse.phoneNumber = user.phoneNumber;
      userResponse.assignedHostel = user.assignedHostel;
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: userResponse,
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
    const userId = req.user._id;
    const userRole = req.userRole;

    // Fetch user with password field (middleware excludes it)
    let user;
    switch (userRole) {
      case 'admin':
        user = await Admin.findById(userId);
        break;
      case 'student':
        user = await Student.findById(userId);
        break;
      case 'porter':
        user = await Porter.findById(userId);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid user role',
        });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

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
    const userId = req.user._id;
    const userRole = req.userRole;
    
    console.log(`Fetching profile for ${userRole}:`, userId);
    
    let user;

    // Fetch fresh user data from database with populated fields
    if (userRole === 'admin') {
      user = await Admin.findById(userId).select('-password');
    } else if (userRole === 'porter') {
      user = await Porter.findById(userId)
        .select('-password')
        .populate('assignedHostel', 'name code location gender');
    } else if (userRole === 'student') {
      user = await Student.findById(userId)
        .select('-password')
        .populate('college', 'name')
        .populate('department', 'name')
        .populate('assignedHostel', 'name code')
        .populate('assignedRoom', 'roomNumber floor')
        .populate('assignedBunk', 'bunkNumber');
    }

    if (!user) {
      console.log('User not found:', userId);
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    console.log(`Profile fetched successfully for ${userRole}:`, user._id);
    console.log('User data:', JSON.stringify(user, null, 2));

    // Convert to plain object and add combined name field
    const userObject = user.toObject();
    if (userObject.firstName && userObject.lastName) {
      userObject.name = `${userObject.firstName} ${userObject.lastName}`;
    } else if (userObject.firstName) {
      userObject.name = userObject.firstName;
    } else if (userObject.lastName) {
      userObject.name = userObject.lastName;
    }

    // For students, add matricNumber alias and ensure populated fields are properly formatted
    if (userRole === 'student') {
      // Add matricNumber as an alias for matricNo
      userObject.matricNumber = userObject.matricNo;
      
      // Ensure college, department, level, and gender are available at root level
      // These should already be populated, but let's ensure they're accessible
      console.log('Student specific fields:');
      console.log('- matricNo:', userObject.matricNo);
      console.log('- college:', userObject.college);
      console.log('- department:', userObject.department);
      console.log('- level:', userObject.level);
      console.log('- gender:', userObject.gender);
    }

    res.status(200).json({
      success: true,
      user: userObject,
      role: userRole,
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
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.userRole;
    const updateData = req.body;

    console.log(`Updating profile for ${userRole}:`, userId);
    console.log('Update data received:', updateData);

    // Remove sensitive fields that shouldn't be updated via profile
    delete updateData.password;
    delete updateData.email; // Email changes should go through a separate verification flow
    delete updateData.role;
    delete updateData._id;

    let updatedUser;

    // Update based on user role
    if (userRole === 'admin') {
      updatedUser = await Admin.findByIdAndUpdate(
        userId,
        { 
          firstName: updateData.firstName,
          lastName: updateData.lastName,
          phoneNumber: updateData.phoneNumber,
        },
        { new: true, runValidators: true }
      ).select('-password');
    } else if (userRole === 'porter') {
      updatedUser = await Porter.findByIdAndUpdate(
        userId,
        {
          firstName: updateData.firstName,
          lastName: updateData.lastName,
          phoneNumber: updateData.phoneNumber,
          shiftSchedule: updateData.shiftSchedule,
        },
        { new: true, runValidators: true }
      ).select('-password').populate('assignedHostel', 'name code location');
    } else if (userRole === 'student') {
      // Build update object for student with only provided fields
      const studentUpdate = {};
      
      // Handle name field (split into firstName and lastName if provided)
      if (updateData.name !== undefined) {
        const nameParts = updateData.name.trim().split(' ');
        if (nameParts.length >= 2) {
          studentUpdate.firstName = nameParts[0];
          studentUpdate.lastName = nameParts.slice(1).join(' ');
        }
      }
      
      // Individual name fields take precedence
      if (updateData.firstName !== undefined) studentUpdate.firstName = updateData.firstName;
      if (updateData.lastName !== undefined) studentUpdate.lastName = updateData.lastName;
      if (updateData.phoneNumber !== undefined) studentUpdate.phoneNumber = updateData.phoneNumber;
      if (updateData.address !== undefined) studentUpdate.address = updateData.address;
      if (updateData.dateOfBirth !== undefined) studentUpdate.dateOfBirth = updateData.dateOfBirth;
      if (updateData.emergencyContact !== undefined) studentUpdate.emergencyContact = updateData.emergencyContact;
      if (updateData.gender !== undefined) studentUpdate.gender = updateData.gender;
      if (updateData.matricNumber !== undefined) studentUpdate.matricNo = updateData.matricNumber;
      if (updateData.level !== undefined) studentUpdate.level = updateData.level;
      
      // Allow email update (optional - you can remove this if email should not be changeable)
      if (updateData.email !== undefined && updateData.email !== req.user.email) {
        // Check if email already exists
        const existingStudent = await Student.findOne({ 
          email: updateData.email.toLowerCase(),
          _id: { $ne: userId }
        });
        if (existingStudent) {
          return res.status(400).json({
            success: false,
            message: 'Email already in use by another student'
          });
        }
        studentUpdate.email = updateData.email.toLowerCase();
      }

      console.log('Student update object:', studentUpdate);

      updatedUser = await Student.findByIdAndUpdate(
        userId,
        studentUpdate,
        { new: true, runValidators: true }
      )
      .select('-password')
      .populate('college', 'name')
      .populate('department', 'name')
      .populate('assignedHostel', 'name code')
      .populate('assignedRoom', 'roomNumber')
      .populate('assignedBunk', 'bunkNumber');
    }

    if (!updatedUser) {
      console.log('User not found for update:', userId);
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    console.log(`Profile updated successfully for ${userRole}:`, updatedUser._id);
    console.log('Updated user data:', JSON.stringify(updatedUser, null, 2));

    // Convert to plain object and add combined name field
    const userObject = updatedUser.toObject();
    if (userObject.firstName && userObject.lastName) {
      userObject.name = `${userObject.firstName} ${userObject.lastName}`;
    } else if (userObject.firstName) {
      userObject.name = userObject.firstName;
    } else if (userObject.lastName) {
      userObject.name = userObject.lastName;
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: userObject,
      data: userObject, // Some frontends might expect 'data' instead of 'user'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating profile',
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
  updateProfile,
  logout,
  forgotPassword,
};
