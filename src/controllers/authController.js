const Admin = require('../models/Admin');
const Student = require('../models/Student');
const Porter = require('../models/Porter');
const jwt = require('jsonwebtoken');
const { generateToken } = require('../middlewares/authMiddleware');
const { generateDefaultPassword } = require('../utils/passwordUtils');
const { buildProfilePictureUrl, updateStudentProfile } = require('../utils/studentProfileUtils');
const config = require('../config/env');
const emailService = require('../services/emailService');
const login = async (req, res) => {
    try {
        const { password } = req.body;
        const identifier = req.body.identifier || req.body.matricNumber;
        let user, role;
        const isEmail = identifier.includes('@');
        if (isEmail) {
            user = await Admin.findOne({ email: identifier.toLowerCase() });
            if (user) {
                role = 'admin';
            }
            else {
                user = await Porter.findOne({ email: identifier.toLowerCase() });
                if (user) {
                    role = 'porter';
                    if (!user.approved) {
                        return res.status(403).json({
                            success: false,
                            message: 'Your application is still pending approval',
                        });
                    }
                }
                else {
                    user = await Student.findOne({ email: identifier.toLowerCase() })
                        .populate('college', 'name code')
                        .populate('department', 'name code');
                    if (user) {
                        role = 'student';
                    }
                }
            }
        }
        else {
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
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated. Please contact admin.',
            });
        }
        const isPasswordMatch = await user.comparePassword(password);
        if (!isPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }
        user.lastLogin = new Date();
        await user.save();
        const token = generateToken(user._id, role);
        const userResponse = {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role,
            firstLogin: user.firstLogin,
        };
        if (role === 'student') {
            userResponse.matricNumber = user.matricNo;
            userResponse.matricNo = user.matricNo;
            userResponse.level = user.level;
            userResponse.gender = user.gender;
            userResponse.phoneNumber = user.phoneNumber;
            userResponse.profilePicture = user.profilePicture;
            userResponse.college = user.college;
            userResponse.department = user.department;
            userResponse.paymentStatus = user.paymentStatus;
            userResponse.reservationStatus = user.reservationStatus;
        }
        else if (role === 'porter') {
            userResponse.phoneNumber = user.phoneNumber;
            userResponse.assignedHostel = user.assignedHostel;
        }
        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: userResponse,
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
        });
    }
};
const changePassword = async (req, res) => {
    try {
        const oldPassword = req.body.oldPassword || req.body.currentPassword;
        const { newPassword } = req.body;
        const userId = req.user._id;
        const userRole = req.userRole;
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
        const isMatch = await user.comparePassword(oldPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect',
            });
        }
        user.password = newPassword;
        user.firstLogin = false;
        await user.save();
        res.status(200).json({
            success: true,
            message: 'Password changed successfully',
        });
    }
    catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while changing password',
        });
    }
};
const getProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.userRole;
        console.log(`Fetching profile for ${userRole}:`, userId);
        let user;
        if (userRole === 'admin') {
            user = await Admin.findById(userId).select('-password');
        }
        else if (userRole === 'porter') {
            user = await Porter.findById(userId)
                .select('-password')
                .populate('assignedHostel', 'name code location gender');
        }
        else if (userRole === 'student') {
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
        const userObject = user.toObject();
        if (userObject.firstName && userObject.lastName) {
            userObject.name = `${userObject.firstName} ${userObject.lastName}`;
        }
        else if (userObject.firstName) {
            userObject.name = userObject.firstName;
        }
        else if (userObject.lastName) {
            userObject.name = userObject.lastName;
        }
        if (userRole === 'student') {
            userObject.matricNumber = userObject.matricNo;
            userObject.phone = userObject.phoneNumber;
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
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching profile',
        });
    }
};
const updateProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.userRole;
        const updateData = req.body;
        console.log(`Updating profile for ${userRole}:`, userId);
        console.log('Update data received:', updateData);
        delete updateData.password;
        delete updateData.email;
        delete updateData.role;
        delete updateData._id;
        let updatedUser;
        if (userRole === 'admin') {
            updatedUser = await Admin.findByIdAndUpdate(userId, {
                firstName: updateData.firstName,
                lastName: updateData.lastName,
                phoneNumber: updateData.phoneNumber,
            }, { new: true, runValidators: true }).select('-password');
        }
        else if (userRole === 'porter') {
            updatedUser = await Porter.findByIdAndUpdate(userId, {
                firstName: updateData.firstName,
                lastName: updateData.lastName,
                phoneNumber: updateData.phoneNumber,
                shiftSchedule: updateData.shiftSchedule,
            }, { new: true, runValidators: true }).select('-password').populate('assignedHostel', 'name code location');
        }
        else if (userRole === 'student') {
            const studentUpdate = {};
            if (updateData.name !== undefined) {
                const nameParts = updateData.name.trim().split(' ');
                if (nameParts.length >= 2) {
                    studentUpdate.firstName = nameParts[0];
                    studentUpdate.lastName = nameParts.slice(1).join(' ');
                }
            }
            if (updateData.firstName !== undefined)
                studentUpdate.firstName = updateData.firstName;
            if (updateData.lastName !== undefined)
                studentUpdate.lastName = updateData.lastName;
            if (updateData.phoneNumber !== undefined)
                studentUpdate.phoneNumber = updateData.phoneNumber;
            if (updateData.phone !== undefined)
                studentUpdate.phoneNumber = updateData.phone;
            if (updateData.address !== undefined)
                studentUpdate.address = updateData.address;
            if (updateData.dateOfBirth !== undefined)
                studentUpdate.dateOfBirth = updateData.dateOfBirth;
            if (updateData.emergencyContact !== undefined)
                studentUpdate.emergencyContact = updateData.emergencyContact;
            if (updateData.gender !== undefined)
                studentUpdate.gender = updateData.gender;
            if (updateData.matricNumber !== undefined)
                studentUpdate.matricNo = updateData.matricNumber;
            if (updateData.level !== undefined)
                studentUpdate.level = updateData.level;
            if (updateData.theme !== undefined && ['light', 'dark'].includes(updateData.theme)) {
                studentUpdate.theme = updateData.theme;
            }
            if (Object.prototype.hasOwnProperty.call(updateData, 'profilePicture')) {
                studentUpdate.profilePicture = updateData.profilePicture || null;
            }
            if (updateData.email !== undefined && updateData.email !== req.user.email) {
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
            updatedUser = await updateStudentProfile(userId, studentUpdate);
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
        const userObject = updatedUser.toObject();
        if (userObject.firstName && userObject.lastName) {
            userObject.name = `${userObject.firstName} ${userObject.lastName}`;
        }
        else if (userObject.firstName) {
            userObject.name = userObject.firstName;
        }
        else if (userObject.lastName) {
            userObject.name = userObject.lastName;
        }
        if (userRole === 'student') {
            userObject.matricNumber = userObject.matricNo;
            userObject.phone = userObject.phoneNumber;
        }
        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: userObject,
            data: userObject,
        });
    }
    catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while updating profile',
        });
    }
};
const uploadProfilePicture = async (req, res) => {
    try {
        if (req.userRole !== 'student') {
            return res.status(403).json({
                success: false,
                message: 'Only students can upload a profile picture',
            });
        }
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided',
            });
        }
        const pictureUrl = buildProfilePictureUrl(req, req.file.filename);
        const updatedUser = await updateStudentProfile(req.user._id, {
            profilePicture: pictureUrl,
        });
        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }
        const userObject = updatedUser.toObject();
        if (userObject.firstName && userObject.lastName) {
            userObject.name = `${userObject.firstName} ${userObject.lastName}`;
        }
        else if (userObject.firstName) {
            userObject.name = userObject.firstName;
        }
        else if (userObject.lastName) {
            userObject.name = userObject.lastName;
        }
        userObject.matricNumber = userObject.matricNo;
        userObject.phone = userObject.phoneNumber;
        res.status(200).json({
            success: true,
            message: 'Profile picture updated successfully',
            user: userObject,
            data: {
                student: userObject,
            },
        });
    }
    catch (error) {
        console.error('Upload profile picture error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while uploading profile picture',
        });
    }
};
const logout = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            message: 'Logout successful',
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during logout',
        });
    }
};
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
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
            return res.status(200).json({
                success: true,
                message: 'If an account exists with this email, a password reset link has been sent.',
            });
        }
        const resetToken = jwt.sign({
            id: user._id.toString(),
            role,
            purpose: 'password-reset',
        }, config.JWT_SECRET, { expiresIn: '1h' });
        await emailService.sendPasswordResetEmail(email, resetToken);
        res.status(200).json({
            success: true,
            message: 'Password reset link has been sent to your email',
        });
    }
    catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while processing request',
        });
    }
};
const resetPassword = async (req, res) => {
    try {
        const { token } = req.body;
        const newPassword = req.body.newPassword || req.body.password;
        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Reset token and new password are required',
            });
        }
        let decoded;
        try {
            decoded = jwt.verify(token, config.JWT_SECRET);
        }
        catch (error) {
            return res.status(400).json({
                success: false,
                message: 'Reset link is invalid or has expired',
            });
        }
        if (decoded.purpose !== 'password-reset') {
            return res.status(400).json({
                success: false,
                message: 'Invalid reset token',
            });
        }
        let user;
        switch (decoded.role) {
            case 'admin':
                user = await Admin.findById(decoded.id);
                break;
            case 'porter':
                user = await Porter.findById(decoded.id);
                break;
            case 'student':
                user = await Student.findById(decoded.id);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid reset token',
                });
        }
        if (!user || !user.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Reset link is no longer valid',
            });
        }
        user.password = newPassword;
        if ('firstLogin' in user) {
            user.firstLogin = false;
        }
        await user.save();
        res.status(200).json({
            success: true,
            message: 'Password reset successfully',
        });
    }
    catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while resetting password',
        });
    }
};
module.exports = {
    login,
    changePassword,
    getProfile,
    updateProfile,
    uploadProfilePicture,
    logout,
    forgotPassword,
    resetPassword,
};
