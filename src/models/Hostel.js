const mongoose = require('mongoose');

const hostelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  level: {
    type: Number,
    required: true,
    enum: [100, 200, 300, 400, 500],
  },
  totalRooms: {
    type: Number,
    required: true,
    min: 1,
  },
  portersAssigned: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Porter',
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  description: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual for rooms
hostelSchema.virtual('rooms', {
  ref: 'Room',
  localField: '_id',
  foreignField: 'hostel',
});

// Virtual for occupancy stats
hostelSchema.virtual('occupancyStats').get(function() {
  return {
    totalRooms: this.totalRooms,
    porterCount: this.portersAssigned ? this.portersAssigned.length : 0,
  };
});

module.exports = mongoose.model('Hostel', hostelSchema);
