const mongoose = require('mongoose');
const roomSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: true,
        trim: true,
    },
    floor: {
        type: Number,
        required: false,
        min: 0,
    },
    capacity: {
        type: Number,
        required: true,
        min: 2,
    },
    currentOccupants: {
        type: Number,
        default: 0,
        min: 0,
    },
    level: {
        type: Number,
        required: true,
        enum: [100, 200, 300, 400, 500],
    },
    hostel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hostel',
        required: true,
    },
    status: {
        type: String,
        enum: ['available', 'partially_occupied', 'full', 'maintenance'],
        default: 'available',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
roomSchema.index({ roomNumber: 1, hostel: 1 }, { unique: true });
roomSchema.virtual('students', {
    ref: 'Student',
    localField: '_id',
    foreignField: 'assignedRoom',
});
roomSchema.virtual('bunks', {
    ref: 'Bunk',
    localField: '_id',
    foreignField: 'room',
});
roomSchema.virtual('totalBunks').get(function () {
    return Math.floor(this.capacity / 2);
});
roomSchema.virtual('availableSpaces').get(function () {
    return this.capacity - this.currentOccupants;
});
roomSchema.methods.updateStatus = async function () {
    if (this.currentOccupants === 0) {
        this.status = 'available';
    }
    else if (this.currentOccupants < this.capacity) {
        this.status = 'partially_occupied';
    }
    else if (this.currentOccupants >= this.capacity) {
        this.status = 'full';
    }
    await this.save();
};
module.exports = mongoose.model('Room', roomSchema);
