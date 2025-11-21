const mongoose = require('mongoose');

const paymentConfigSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  description: {
    type: String,
    default: 'Hostel Accommodation Fee',
  },
  academicYear: {
    type: String,
    trim: true,
  },
  semester: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
}, {
  timestamps: true,
});

// Ensure only one active config at a time
paymentConfigSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

module.exports = mongoose.model('PaymentConfig', paymentConfigSchema);
