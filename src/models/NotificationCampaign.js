const mongoose = require('mongoose');
const recipientSampleSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
    },
    name: {
        type: String,
        trim: true,
    },
    matricNo: {
        type: String,
        trim: true,
        uppercase: true,
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
    },
    inboxSaved: {
        type: Boolean,
        default: true,
    },
    pushAttempted: {
        type: Boolean,
        default: false,
    },
    pushDelivered: {
        type: Boolean,
        default: false,
    },
    emailSent: {
        type: Boolean,
        default: false,
    },
}, { _id: false });
const notificationCampaignSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true,
    },
    mode: {
        type: String,
        enum: ['test', 'broadcast'],
        required: true,
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
    destination: {
        type: String,
        default: '/student/notifications',
        trim: true,
    },
    forceEmail: {
        type: Boolean,
        default: false,
    },
    target: {
        scope: {
            type: String,
            enum: ['student', 'hostel', 'college', 'department', 'level', 'all'],
            default: 'all',
        },
        label: {
            type: String,
            trim: true,
        },
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student',
        },
        hostel: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Hostel',
        },
        college: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'College',
        },
        department: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Department',
        },
        level: {
            type: Number,
            enum: [100, 200, 300, 400, 500],
        },
    },
    stats: {
        recipients: {
            type: Number,
            default: 0,
        },
        inboxSaved: {
            type: Number,
            default: 0,
        },
        pushAttempted: {
            type: Number,
            default: 0,
        },
        pushDelivered: {
            type: Number,
            default: 0,
        },
        emailSent: {
            type: Number,
            default: 0,
        },
    },
    status: {
        type: String,
        enum: ['completed', 'partial', 'failed'],
        default: 'completed',
    },
    recipientSample: {
        type: [recipientSampleSchema],
        default: [],
    },
}, {
    timestamps: true,
});
notificationCampaignSchema.index({ createdAt: -1 });
notificationCampaignSchema.index({ mode: 1, createdAt: -1 });
notificationCampaignSchema.index({ 'target.scope': 1, createdAt: -1 });
module.exports = mongoose.model('NotificationCampaign', notificationCampaignSchema);
