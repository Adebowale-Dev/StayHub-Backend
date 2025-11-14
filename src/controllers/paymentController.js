const Payment = require('../models/Payment');
const Student = require('../models/Student');
const paystackService = require('../services/paystackService');
const notificationService = require('../services/notificationService');
const cacheService = require('../services/cacheService');
const { generateReference, generatePaymentCode } = require('../utils/generateCode');
const { getCurrentAcademicYear, getCurrentSemester } = require('../utils/dateUtils');

/**
 * @desc    Initialize payment (Student)
 * @route   POST /api/payments/initialize
 * @access  Private (Student)
 */
const initializePayment = async (req, res) => {
  try {
    const student = req.user;

    // Check if student already paid
    if (student.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'You have already completed payment for this semester',
      });
    }

    // Get payment amount from cache (set by admin)
    const paymentAmount = cacheService.get(cacheService.cacheKeys.paymentAmount());
    
    if (!paymentAmount) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount not set. Please contact admin.',
      });
    }

    // Generate unique reference
    const reference = generateReference('PAY');

    // Initialize payment with Paystack
    const paystackData = await paystackService.initializeTransaction({
      email: student.email,
      amount: paymentAmount,
      reference,
      metadata: {
        student_id: student._id.toString(),
        matric_no: student.matricNo,
        full_name: `${student.firstName} ${student.lastName}`,
        level: student.level,
        semester: getCurrentSemester(),
        academic_year: getCurrentAcademicYear(),
      },
    });

    // Create payment record
    const payment = await Payment.create({
      student: student._id,
      amount: paymentAmount,
      paymentReference: reference,
      paymentCode: generatePaymentCode(),
      status: 'pending',
      semester: getCurrentSemester(),
      academicYear: getCurrentAcademicYear(),
    });

    res.status(200).json({
      success: true,
      message: 'Payment initialized successfully',
      data: {
        authorizationUrl: paystackData.data.authorization_url,
        reference: paystackData.data.reference,
        accessCode: paystackData.data.access_code,
      },
    });
  } catch (error) {
    console.error('Initialize payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to initialize payment',
    });
  }
};

/**
 * @desc    Verify payment (Callback from Paystack)
 * @route   GET /api/payments/verify/:reference
 * @access  Public
 */
const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    // Verify with Paystack
    const verification = await paystackService.verifyTransaction(reference);

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
      });
    }

    const paymentData = verification.data;

    // Find payment record
    const payment = await Payment.findOne({ paymentReference: reference });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found',
      });
    }

    // Check if already verified
    if (payment.status === 'successful') {
      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        data: payment,
      });
    }

    // Update payment status
    if (paymentData.status === 'success') {
      payment.status = 'successful';
      payment.datePaid = new Date();
      payment.paystackResponse = paymentData;
      await payment.save();

      // Update student payment status
      const student = await Student.findById(payment.student);
      student.paymentStatus = 'paid';
      student.paymentReference = reference;
      student.paymentCode = payment.paymentCode;
      await student.save();

      // Send payment confirmation email
      await notificationService.notifyPaymentSuccess(student._id, payment);

      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          paymentCode: payment.paymentCode,
          amount: payment.amount,
          reference: payment.paymentReference,
          datePaid: payment.datePaid,
        },
      });
    } else {
      payment.status = 'failed';
      payment.paystackResponse = paymentData;
      await payment.save();

      res.status(400).json({
        success: false,
        message: 'Payment failed',
      });
    }
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify payment',
    });
  }
};

/**
 * @desc    Get student payment status
 * @route   GET /api/payments/status
 * @access  Private (Student)
 */
const getPaymentStatus = async (req, res) => {
  try {
    const student = req.user;

    const payments = await Payment.find({ student: student._id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        paymentStatus: student.paymentStatus,
        paymentCode: student.paymentCode,
        payments,
      },
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment status',
    });
  }
};

/**
 * @desc    Set payment amount (Admin)
 * @route   POST /api/payments/set-amount
 * @access  Private (Admin)
 */
const setPaymentAmount = async (req, res) => {
  try {
    const { amount, semester, academicYear } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount',
      });
    }

    // Store in cache
    cacheService.set(cacheService.cacheKeys.paymentAmount(), amount);

    res.status(200).json({
      success: true,
      message: 'Payment amount set successfully',
      data: {
        amount,
        semester: semester || getCurrentSemester(),
        academicYear: academicYear || getCurrentAcademicYear(),
      },
    });
  } catch (error) {
    console.error('Set payment amount error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set payment amount',
    });
  }
};

/**
 * @desc    Get current payment amount (Admin/Student)
 * @route   GET /api/payments/amount
 * @access  Private
 */
const getPaymentAmount = async (req, res) => {
  try {
    const amount = cacheService.get(cacheService.cacheKeys.paymentAmount());

    if (!amount) {
      return res.status(404).json({
        success: false,
        message: 'Payment amount not set',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        amount,
        semester: getCurrentSemester(),
        academicYear: getCurrentAcademicYear(),
      },
    });
  } catch (error) {
    console.error('Get payment amount error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment amount',
    });
  }
};

/**
 * @desc    Get all payments (Admin)
 * @route   GET /api/payments
 * @access  Private (Admin)
 */
const getAllPayments = async (req, res) => {
  try {
    const { status, semester, academicYear, page = 1, limit = 50 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (semester) query.semester = semester;
    if (academicYear) query.academicYear = academicYear;

    const payments = await Payment.find(query)
      .populate('student', 'firstName lastName matricNo email level')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Payment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: payments,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (error) {
    console.error('Get all payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
    });
  }
};

/**
 * @desc    Get payment statistics (Admin)
 * @route   GET /api/payments/stats
 * @access  Private (Admin)
 */
const getPaymentStats = async (req, res) => {
  try {
    const totalPayments = await Payment.countDocuments({ status: 'successful' });
    const pendingPayments = await Payment.countDocuments({ status: 'pending' });
    const failedPayments = await Payment.countDocuments({ status: 'failed' });

    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'successful' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const studentsPaid = await Student.countDocuments({ paymentStatus: 'paid' });
    const studentsPending = await Student.countDocuments({ paymentStatus: 'pending' });

    res.status(200).json({
      success: true,
      data: {
        totalPayments,
        pendingPayments,
        failedPayments,
        totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
        studentsPaid,
        studentsPending,
      },
    });
  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment statistics',
    });
  }
};

module.exports = {
  initializePayment,
  verifyPayment,
  getPaymentStatus,
  setPaymentAmount,
  getPaymentAmount,
  getAllPayments,
  getPaymentStats,
};
