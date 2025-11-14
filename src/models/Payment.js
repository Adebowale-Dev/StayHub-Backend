const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  paymentReference: {
    type: String,
    required: true,
    unique: true,
  },
  paymentCode: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ['pending', 'successful', 'failed', 'cancelled'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    default: 'paystack',
  },
  datePaid: {
    type: Date,
  },
  paystackResponse: {
    type: mongoose.Schema.Types.Mixed,
  },
  semester: {
    type: String,
    trim: true,
  },
  academicYear: {
    type: String,
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

// Index for quick lookups (unique indexes already created by schema definition above)
paymentSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
