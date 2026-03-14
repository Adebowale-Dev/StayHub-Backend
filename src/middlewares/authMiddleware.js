const jwt = require('jsonwebtoken');
const config = require('../config/env');
const Admin = require('../models/Admin');
const Student = require('../models/Student');
const Porter = require('../models/Porter');
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, config.JWT_SECRET);
            let user;
            switch (decoded.role) {
                case 'admin':
                    user = await Admin.findById(decoded.id).select('-password');
                    break;
                case 'student':
                    user = await Student.findById(decoded.id)
                        .select('-password')
                        .populate('college department assignedHostel assignedRoom assignedBunk');
                    break;
                case 'porter':
                    user = await Porter.findById(decoded.id)
                        .select('-password')
                        .populate('assignedHostel');
                    break;
                default:
                    throw new Error('Invalid role');
            }
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Not authorized, user not found',
                });
            }
            if (!user.isActive) {
                return res.status(401).json({
                    success: false,
                    message: 'Account is deactivated',
                });
            }
            req.user = user;
            req.userRole = decoded.role;
            next();
        }
        catch (error) {
            console.error('Auth middleware error:', error);
            return res.status(401).json({
                success: false,
                message: 'Not authorized, token failed',
            });
        }
    }
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized, no token',
        });
    }
};
const checkFirstLogin = async (req, res, next) => {
    if (req.user.firstLogin && req.path !== '/change-password') {
        return res.status(403).json({
            success: false,
            message: 'Please change your password before proceeding',
            firstLogin: true,
        });
    }
    next();
};
const generateToken = (id, role) => {
    return jwt.sign({ id, role }, config.JWT_SECRET, {
        expiresIn: config.JWT_EXPIRES_IN,
    });
};
module.exports = {
    protect,
    checkFirstLogin,
    generateToken,
};
