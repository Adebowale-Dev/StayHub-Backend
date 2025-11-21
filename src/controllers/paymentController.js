const Payment = require('../models/Payment');
const Student = require('../models/Student');
const PaymentConfig = require('../models/PaymentConfig');
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

    // Get payment amount from cache or database
    let paymentAmount = cacheService.get(cacheService.cacheKeys.paymentAmount());
    
    if (!paymentAmount) {
      const config = await PaymentConfig.findOne({});
      if (!config) {
        return res.status(400).json({
          success: false,
          message: 'Payment amount not set. Please contact admin.',
        });
      }
      paymentAmount = config.amount;
      cacheService.set(cacheService.cacheKeys.paymentAmount(), paymentAmount);
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
    if (payment.status === 'completed') {
      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        data: payment,
      });
    }

    // Update payment status
    if (paymentData.status === 'success') {
      payment.status = 'completed';
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
 * @route   POST /api/admin/payment/set-amount
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

    console.log(`Admin setting payment amount to ${amount}`);

    // 1. Save to database using findOneAndUpdate with upsert
    const config = await PaymentConfig.findOneAndUpdate(
      {}, // Find any config (there should only be one)
      { 
        amount,
        semester: semester || getCurrentSemester(),
        academicYear: academicYear || getCurrentAcademicYear(),
        updatedBy: req.user?._id,
      },
      { upsert: true, new: true } // Create if doesn't exist, return updated doc
    );

    // 2. AUTOMATICALLY UPDATE ALL PENDING/FAILED PAYMENTS
    // Only update payments that haven't been completed yet
    const updateResult = await Payment.updateMany(
      { status: { $in: ['pending', 'failed'] } },
      { $set: { amount: amount } }
    );
    console.log(`Updated ${updateResult.modifiedCount} existing pending/failed payments`);

    // 3. CREATE PAYMENT RECORDS FOR STUDENTS WITHOUT PAYMENTS
    // Find students who don't have any payment records yet
    const studentsWithPayments = await Payment.distinct('student');
    const studentsWithoutPayments = await Student.find({
      _id: { $nin: studentsWithPayments },
      isActive: true,
    });

    let newPaymentsCreated = 0;
    if (studentsWithoutPayments.length > 0) {
      const newPayments = studentsWithoutPayments.map(student => ({
        student: student._id,
        amount: amount,
        paymentReference: generateReference('PAY'),
        paymentCode: generatePaymentCode(),
        status: 'pending',
        semester: semester || getCurrentSemester(),
        academicYear: academicYear || getCurrentAcademicYear(),
      }));

      const insertedPayments = await Payment.insertMany(newPayments);
      newPaymentsCreated = insertedPayments.length;
      console.log(`Created ${newPaymentsCreated} new payment records for students`);
    }

    // 4. Also update cache for faster access
    cacheService.set(cacheService.cacheKeys.paymentAmount(), amount);

    res.status(200).json({
      success: true,
      message: 'Payment amount updated for all students',
      data: {
        amount: config.amount,
        semester: config.semester,
        academicYear: config.academicYear,
        updatedPayments: updateResult.modifiedCount,
        newPayments: newPaymentsCreated,
        totalAffected: updateResult.modifiedCount + newPaymentsCreated,
      },
    });
  } catch (error) {
    console.error('Set payment amount error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment amount',
      error: error.message,
    });
  }
};

/**
 * @desc    Get current payment amount (Admin/Student)
 * @route   GET /api/admin/payment/amount
 * @access  Private
 */
const getPaymentAmount = async (req, res) => {
  try {
    // Try to get from cache first for performance
    let amount = cacheService.get(cacheService.cacheKeys.paymentAmount());

    // If not in cache, get from database
    if (!amount) {
      const config = await PaymentConfig.findOne({});
      
      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Payment amount not configured yet',
        });
      }

      amount = config.amount;
      // Update cache for next time
      cacheService.set(cacheService.cacheKeys.paymentAmount(), amount);
    }

    res.status(200).json({
      success: true,
      data: {
        amount,
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
 * @route   GET /api/admin/payments
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
      .skip((page - 1) * limit)
      .lean();

    // Transform the data to match frontend expectations
    const transformedPayments = payments.map(payment => ({
      ...payment,
      student: payment.student ? {
        _id: payment.student._id,
        name: `${payment.student.firstName} ${payment.student.lastName}`,
        matricNumber: payment.student.matricNo,
        email: payment.student.email,
        level: payment.student.level,
        firstName: payment.student.firstName,
        lastName: payment.student.lastName,
      } : null,
      reference: payment.paymentReference,
      paymentDate: payment.datePaid || payment.createdAt,
    }));

    const count = await Payment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: transformedPayments,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
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
 * @route   GET /api/admin/payment/stats
 * @access  Private (Admin)
 */
const getPaymentStats = async (req, res) => {
  try {
    const stats = await Payment.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0]
            }
          },
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0]
            }
          },
          totalPending: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending"] }, 1, 0]
            }
          },
          totalFailed: {
            $sum: {
              $cond: [{ $eq: ["$status", "failed"] }, 1, 0]
            }
          }
        }
      }
    ]);

    const result = stats.length > 0 ? stats[0] : {
      totalRevenue: 0,
      totalPaid: 0,
      totalPending: 0,
      totalFailed: 0
    };

    // Remove the _id field
    delete result._id;

    res.status(200).json({
      success: true,
      data: result,
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
