const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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

// Indexes for performance optimization
// Note: matricNo and email already have indexes from unique: true
studentSchema.index({ level: 1 });
studentSchema.index({ college: 1 });
studentSchema.index({ department: 1 });
studentSchema.index({ paymentStatus: 1 });
studentSchema.index({ reservationStatus: 1 });
studentSchema.index({ assignedHostel: 1 });
studentSchema.index({ isActive: 1 });
studentSchema.index({ level: 1, college: 1, isActive: 1 }); // Compound index for common queries

// Hash password before saving
studentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
studentSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
studentSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('Student', studentSchema);
