const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { DEFAULT_STUDENT_NOTIFICATION_PREFERENCES, } = require('../constants/studentNotificationPreferences');
const studentSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true,
    },
    lastName: {
        type: String,
        required: true,
        trim: true,
    },
    matricNo: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    phoneNumber: {
        type: String,
        trim: true,
    },
    address: {
        type: String,
        trim: true,
    },
    dateOfBirth: {
        type: Date,
    },
    emergencyContact: {
        type: String,
        trim: true,
    },
    profilePicture: {
        type: String,
        default: null,
    },
    theme: {
        type: String,
        enum: ['light', 'dark'],
        default: 'light',
    },
    level: {
        type: Number,
        required: true,
        enum: [100, 200, 300, 400, 500],
    },
    gender: {
        type: String,
        required: true,
        enum: ['male', 'female'],
        lowercase: true,
    },
    college: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'College',
        required: true,
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: true,
    },
    assignedHostel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hostel',
    },
    assignedRoom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
    },
    assignedBunk: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bunk',
    },
    roommates: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student',
        }],
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending',
    },
    paymentReference: {
        type: String,
    },
    paymentCode: {
        type: String,
        unique: true,
        sparse: true,
    },
    reservationStatus: {
        type: String,
        enum: ['none', 'temporary', 'confirmed', 'checked_in', 'expired'],
        default: 'none',
    },
    reservedAt: {
        type: Date,
    },
    reservationExpiresAt: {
        type: Date,
    },
    checkInDate: {
        type: Date,
    },
    reservedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
    },
    invitationHistory: [{
            action: {
                type: String,
                enum: ['invited', 'approved', 'rejected', 'expired'],
                required: true,
            },
            role: {
                type: String,
                enum: ['inviter', 'invitee'],
                required: true,
            },
            actor: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Student',
            },
            relatedStudent: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Student',
            },
            hostel: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Hostel',
            },
            hostelName: {
                type: String,
                trim: true,
            },
            room: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Room',
            },
            roomNumber: {
                type: String,
                trim: true,
            },
            bunk: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Bunk',
            },
            bunkNumber: {
                type: String,
                trim: true,
            },
            notes: {
                type: String,
                trim: true,
            },
            createdAt: {
                type: Date,
                default: Date.now,
            },
        }],
    notificationReads: [{
            notificationId: {
                type: String,
                required: true,
                trim: true,
            },
            readAt: {
                type: Date,
                default: Date.now,
            },
        }],
    notificationPreferences: {
        pushEnabled: {
            type: Boolean,
            default: DEFAULT_STUDENT_NOTIFICATION_PREFERENCES.pushEnabled,
        },
        emailEscalationEnabled: {
            type: Boolean,
            default: DEFAULT_STUDENT_NOTIFICATION_PREFERENCES.emailEscalationEnabled,
        },
        adminAnnouncements: {
            type: Boolean,
            default: DEFAULT_STUDENT_NOTIFICATION_PREFERENCES.adminAnnouncements,
        },
        invitationCreated: {
            type: Boolean,
            default: DEFAULT_STUDENT_NOTIFICATION_PREFERENCES.invitationCreated,
        },
        invitationUpdates: {
            type: Boolean,
            default: DEFAULT_STUDENT_NOTIFICATION_PREFERENCES.invitationUpdates,
        },
        invitationExpired: {
            type: Boolean,
            default: DEFAULT_STUDENT_NOTIFICATION_PREFERENCES.invitationExpired,
        },
        paymentUpdates: {
            type: Boolean,
            default: DEFAULT_STUDENT_NOTIFICATION_PREFERENCES.paymentUpdates,
        },
        reservationUpdates: {
            type: Boolean,
            default: DEFAULT_STUDENT_NOTIFICATION_PREFERENCES.reservationUpdates,
        },
    },
    customNotifications: [{
            notificationId: {
                type: String,
                required: true,
                trim: true,
            },
            source: {
                type: String,
                enum: ['admin_test', 'admin_broadcast'],
                default: 'admin_broadcast',
            },
            title: {
                type: String,
                required: true,
                trim: true,
            },
            message: {
                type: String,
                required: true,
                trim: true,
            },
            type: {
                type: String,
                enum: ['warning', 'info', 'error', 'success'],
                default: 'info',
            },
            icon: {
                type: String,
                trim: true,
            },
            category: {
                type: String,
                default: 'announcement',
                trim: true,
            },
            destination: {
                type: String,
                default: '/student/notifications',
                trim: true,
            },
            campaignId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'NotificationCampaign',
            },
            createdBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Admin',
            },
            createdAt: {
                type: Date,
                default: Date.now,
            },
        }],
    pushDevices: [{
            token: {
                type: String,
                required: true,
                trim: true,
            },
            platform: {
                type: String,
                enum: ['android', 'ios', 'web', 'unknown'],
                default: 'unknown',
            },
            deviceName: {
                type: String,
                trim: true,
            },
            appOwnership: {
                type: String,
                trim: true,
            },
            projectId: {
                type: String,
                trim: true,
            },
            enabled: {
                type: Boolean,
                default: true,
            },
            lastRegisteredAt: {
                type: Date,
                default: Date.now,
            },
            lastSeenAt: {
                type: Date,
                default: Date.now,
            },
        }],
    firstLogin: {
        type: Boolean,
        default: true,
    },
    role: {
        type: String,
        default: 'student',
        immutable: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    lastLogin: {
        type: Date,
    },
}, {
    timestamps: true,
});
studentSchema.index({ level: 1 });
studentSchema.index({ college: 1 });
studentSchema.index({ department: 1 });
studentSchema.index({ paymentStatus: 1 });
studentSchema.index({ reservationStatus: 1 });
studentSchema.index({ assignedHostel: 1 });
studentSchema.index({ isActive: 1 });
studentSchema.index({ level: 1, college: 1, isActive: 1 });
studentSchema.pre('save', async function (next) {
    if (!this.isModified('password'))
        return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    }
    catch (error) {
        next(error);
    }
});
studentSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};
studentSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};
module.exports = mongoose.model('Student', studentSchema);
