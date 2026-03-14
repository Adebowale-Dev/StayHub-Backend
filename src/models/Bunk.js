const mongoose = require('mongoose');
const bunkSchema = new mongoose.Schema({
    bunkNumber: {
        type: String,
        required: true,
        trim: true,
    },
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true,
    },
    occupiedByStudent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
    },
    status: {
        type: String,
        enum: ['available', 'reserved', 'occupied', 'maintenance'],
        default: 'available',
    },
    reservedUntil: {
        type: Date,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});
bunkSchema.index({ bunkNumber: 1, room: 1 }, { unique: true });
bunkSchema.methods.isReservationExpired = function () {
    if (this.status === 'reserved' && this.reservedUntil) {
        return new Date() > this.reservedUntil;
    }
    return false;
};
bunkSchema.methods.releaseIfExpired = async function () {
    if (this.isReservationExpired()) {
        this.status = 'available';
        this.reservedUntil = null;
        await this.save();
        return true;
    }
    return false;
};
module.exports = mongoose.model('Bunk', bunkSchema);
