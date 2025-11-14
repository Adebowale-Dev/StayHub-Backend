const mongoose = require('mongoose');

const collegeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  deanName: {
    type: String,
    trim: true,
  },
  deanEmail: {
    type: String,
    lowercase: true,
    trim: true,
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

// Virtual for departments
collegeSchema.virtual('departments', {
  ref: 'Department',
  localField: '_id',
  foreignField: 'college',
});

module.exports = mongoose.model('College', collegeSchema);
