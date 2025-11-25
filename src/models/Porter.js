const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const porterSchema = new mongoose.Schema({
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
  assignedHostel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
  },
  employeeId: {
    type: String,
    unique: true,
    sparse: true, // Allows null values while maintaining uniqueness
  },
  joinedDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended', 'active'],
    default: 'pending',
  },
  shiftSchedule: {
    type: String,
    trim: true,
  },
  approved: {
    type: Boolean,
    default: false,
  },
  applicationDate: {
    type: Date,
    default: Date.now,
  },
  approvedDate: {
    type: Date,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  firstLogin: {
    type: Boolean,
    default: true,
  },
  role: {
    type: String,
    default: 'porter',
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Hash password before saving
porterSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Virtual for full name
porterSchema.virtual('name').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Method to compare passwords
porterSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
porterSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  // Add name field
  obj.name = this.name;
  return obj;
};

module.exports = mongoose.model('Porter', porterSchema);
