const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  hodName: {
    type: String,
    trim: true,
  },
  hodEmail: {
    type: String,
    lowercase: true,
    trim: true,
  },
  availableLevels: [{
    type: Number,
    enum: [100, 200, 300, 400, 500],
  }],
  college: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Compound unique index for department code within a college
departmentSchema.index({ code: 1, college: 1 }, { unique: true });

module.exports = mongoose.model('Department', departmentSchema);
