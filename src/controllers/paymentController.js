const Payment = require('../models/Payment');
const Student = require('../models/Student');
const PaymentConfig = require('../models/PaymentConfig');
const paystackService = require('../services/paystackService');
const notificationService = require('../services/notificationService');
const cacheService = require('../services/cacheService');
const config = require('../config/env');
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
    const paymentCode = generatePaymentCode();
    console.log('💳 Creating payment record:');
    console.log('   Payment Code:', paymentCode);
    console.log('   Reference:', reference);
    console.log('   Amount:', paymentAmount);
    console.log('   Student ID:', student._id);
    
    const payment = await Payment.create({
      student: student._id,
      amount: paymentAmount,
      paymentReference: reference,
      paymentCode: paymentCode,
      status: 'pending',
      semester: getCurrentSemester(),
      academicYear: getCurrentAcademicYear(),
    });

    console.log('✅ Payment record created in database:');
    console.log('   Payment ID:', payment._id);
    console.log('   Payment Code (saved):', payment.paymentCode);
    console.log('   Status:', payment.status);

    // 🔥 Send payment code email immediately
    try {
      console.log('📧 Sending payment code email...');
      await notificationService.sendPaymentCode(student._id, paymentCode, reference);
      console.log('✅ Payment code email sent to:', student.email);
    } catch (emailError) {
      console.error('⚠️ Failed to send payment code email:', emailError.message);
      console.error('   Error details:', emailError);
      // Continue anyway - student can still complete payment
    }

    res.status(200).json({
      authorizationUrl: paystackData.data.authorization_url,
      reference: paystackData.data.reference,
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

    // Get the most recent payment record for this student
    const latestPayment = await Payment.findOne({ student: student._id })
      .sort({ createdAt: -1 });

    // Get configured payment amount (cache-first)
    let amount = cacheService.get(cacheService.cacheKeys.paymentAmount());
    if (!amount) {
      const paymentConfig = await PaymentConfig.findOne({});
      amount = paymentConfig ? paymentConfig.amount : null;
      if (amount) cacheService.set(cacheService.cacheKeys.paymentAmount(), amount);
    }

    res.status(200).json({
      paymentStatus: student.paymentStatus,
      amount: amount || null,
      reference: latestPayment ? latestPayment.paymentReference : null,
      datePaid: latestPayment && latestPayment.status === 'completed' ? latestPayment.datePaid : null,
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

    res.status(200).json({ amount });
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

/**
 * @desc    Handle Paystack callback redirect
 * @route   GET /api/payments/callback
 * @access  Public
 */
const handlePaystackCallback = async (req, res) => {
  try {
    const { reference, trxref } = req.query;
    const paymentReference = reference || trxref;

    console.log('📞 Paystack callback received. Reference:', paymentReference);

    if (!paymentReference) {
      // Redirect to frontend with error
      return res.redirect(`${config.FRONTEND_URL}/student/payment?status=error&message=No payment reference provided`);
    }

    // Verify with Paystack
    console.log('🔍 Verifying transaction with Paystack...');
    const verification = await paystackService.verifyTransaction(paymentReference);

    if (!verification.success) {
      console.log('❌ Paystack verification failed');
      // Redirect to frontend with error
      return res.redirect(`${config.FRONTEND_URL}/student/payment?status=failed&reference=${paymentReference}`);
    }

    const paymentData = verification.data;
    console.log('✅ Paystack verification successful. Status:', paymentData.status);

    // Find payment record
    const payment = await Payment.findOne({ paymentReference });

    if (!payment) {
      console.log('❌ Payment record not found in database');
      // Redirect to frontend with error
      return res.redirect(`${config.FRONTEND_URL}/student/payment?status=error&message=Payment record not found`);
    }

    // Check if payment transaction was successful on Paystack
    if (paymentData.status === 'success') {
      console.log('💰 Payment successful on Paystack');
      
      // Update payment status to pending verification (not completed yet)
      payment.status = 'pending';
      payment.paystackResponse = paymentData;
      await payment.save();

      // Get student details
      const student = await Student.findById(payment.student);

      // Send payment code via email
      console.log('📧 Sending payment code to student email:', student.email);
      await notificationService.sendPaymentCode(student._id, payment.paymentCode, paymentReference);

      console.log('✅ Payment code sent. Redirecting to verification page...');

      // Redirect to verification page (NOT success page)
      // Student must enter the code from their email to complete verification
      return res.redirect(`${config.FRONTEND_URL}/student/payment/verify?reference=${paymentReference}&message=Payment successful! Check your email for verification code`);
    } else {
      console.log('❌ Payment failed on Paystack. Status:', paymentData.status);
      payment.status = 'failed';
      payment.paystackResponse = paymentData;
      await payment.save();

      // Redirect to frontend with failure
      return res.redirect(`${config.FRONTEND_URL}/student/payment?status=failed&reference=${paymentReference}`);
    }
  } catch (error) {
    console.error('❌ Paystack callback error:', error);
    // Redirect to frontend with error
    return res.redirect(`${config.FRONTEND_URL}/student/payment?status=error&message=${encodeURIComponent(error.message || 'Payment verification failed')}`);
  }
};

/**
 * @desc    Verify payment using payment code
 * @route   POST /api/student/payment/verify-code
 * @access  Private (Student)
 */
const verifyPaymentCode = async (req, res) => {
  try {
    console.log('📥 Payment verification request received:', {
      body: req.body,
      hasUser: !!req.user,
      userId: req.user?._id
    });

    const { paymentCode } = req.body;
    const studentId = req.user?._id;

    // Validate authentication
    if (!req.user || !studentId) {
      console.log('❌ No authenticated user found');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Validate payment code
    if (!paymentCode) {
      console.log('❌ Payment code missing in request');
      return res.status(400).json({
        success: false,
        message: 'Payment code is required'
      });
    }

    if (typeof paymentCode !== 'string' || paymentCode.trim().length === 0) {
      console.log('❌ Invalid payment code format');
      return res.status(400).json({
        success: false,
        message: 'Payment code must be a non-empty string'
      });
    }

    if (paymentCode.length !== 6) {
      console.log('❌ Payment code wrong length:', paymentCode.length);
      return res.status(400).json({
        success: false,
        message: 'Payment code must be exactly 6 characters'
      });
    }

    console.log('🔍 Step 1: Searching for payment');
    console.log('   Payment Code (uppercase):', paymentCode.toUpperCase());
    console.log('   Student ID:', studentId);

    // Find payment by code and student
    const payment = await Payment.findOne({
      student: studentId,
      paymentCode: paymentCode.toUpperCase()
    });

    console.log('🔍 Step 2: Database query result');
    console.log('   Payment found:', !!payment);

    if (!payment) {
      console.log('❌ Payment not found in database');
      console.log('   Searched for code:', paymentCode.toUpperCase());
      console.log('   Student ID:', studentId);
      
      // List all payment codes for this student (debugging)
      const studentPayments = await Payment.find({ student: studentId })
        .select('paymentCode status paymentReference createdAt')
        .sort({ createdAt: -1 })
        .limit(5);
      
      console.log('   Student has these recent payments:');
      studentPayments.forEach(p => {
        console.log(`      - Code: ${p.paymentCode} | Status: ${p.status} | Ref: ${p.paymentReference}`);
      });
      
      // Also check if code exists for ANY student
      const anyPayment = await Payment.findOne({
        paymentCode: paymentCode.toUpperCase()
      }).select('student paymentCode');
      
      if (anyPayment) {
        console.log('⚠️ Code exists but belongs to different student:', anyPayment.student);
      } else {
        console.log('⚠️ Code does not exist in database at all');
      }
      
      return res.status(404).json({
        success: false,
        message: 'Invalid payment code. Please check the code from your email.'
      });
    }

    console.log('✅ Step 3: Payment found');
    console.log('   Payment ID:', payment._id);
    console.log('   Payment Code:', payment.paymentCode);
    console.log('   Status:', payment.status);
    console.log('   Reference:', payment.paymentReference);
    console.log('   Amount:', payment.amount);
    console.log('   Created:', payment.createdAt);

    // Check if already verified/completed
    if (payment.status === 'completed') {
      console.log('✅ Payment already verified');
      return res.json({
        success: true,
        message: 'Payment already verified',
        data: {
          status: 'completed',
          amount: payment.amount,
          paymentCode: payment.paymentCode,
          paymentReference: payment.paymentReference,
          datePaid: payment.datePaid
        }
      });
    }

    // If payment is still pending, verify with Paystack
    if (payment.status === 'pending') {
      console.log('🔍 Step 4: Payment pending, verifying with Paystack...');
      console.log('   Reference:', payment.paymentReference);
      console.log('   Paystack Secret Key exists:', !!process.env.PAYSTACK_SECRET_KEY);
      console.log('   Paystack Secret Key (first 10 chars):', process.env.PAYSTACK_SECRET_KEY?.substring(0, 10) + '...');
      
      try {
        console.log('🔍 Step 5: Calling Paystack verification API...');
        const verification = await paystackService.verifyTransaction(payment.paymentReference);
        
        console.log('🔍 Step 6: Paystack response received');
        console.log('📦 Full Paystack response:', JSON.stringify(verification, null, 2));
        console.log('📦 Raw status value:', verification.data?.status);
        console.log('📦 Status type:', typeof verification.data?.status);
        console.log('📦 Status length:', verification.data?.status?.length);
        console.log('📦 Status === "success":', verification.data?.status === 'success');
        console.log('📦 Status char codes:', verification.data?.status ? [...verification.data.status].map(c => c.charCodeAt(0)) : 'N/A');
        
        const paystackData = verification.data;
        
        // ✅ Clean and normalize the status
        let status = paystackData?.status;
        const originalStatus = status;
        
        // Remove extra quotes and whitespace if it's a string
        if (typeof status === 'string') {
          status = status.trim().replace(/^["']|["']$/g, '').toLowerCase();
        }
        
        console.log('🔍 Status cleaning:');
        console.log('   Original status:', originalStatus);
        console.log('   Cleaned status:', status);
        console.log('   Type after cleaning:', typeof status);
        console.log('   Length after cleaning:', status?.length);
        
        // Valid statuses to accept
        const validStatuses = ['success', 'paid', 'completed'];
        const isVerificationSuccess = verification.status === 'success' || verification.status === true;
        const isPaymentSuccess = validStatuses.includes(status);
        
        console.log('🔍 Validation check:');
        console.log('   Verification status valid:', isVerificationSuccess);
        console.log('   Payment status valid:', isPaymentSuccess);
        console.log('   Cleaned status value:', status);
        console.log('   Valid statuses:', validStatuses);
        
        if (isVerificationSuccess && isPaymentSuccess) {
          console.log('✅ Step 7: Paystack verification successful - Updating database...');
          
          // Update payment status
          payment.status = 'completed';
          payment.datePaid = new Date();
          payment.paystackResponse = verification.data;
          await payment.save();

          console.log('✅ Step 8: Payment record updated');

          // Update student payment status
          await Student.findByIdAndUpdate(studentId, {
            paymentStatus: 'paid'
          });

          console.log('✅ Step 9: Student payment status updated');

          return res.json({
            success: true,
            message: 'Payment verified successfully',
            data: {
              status: 'completed',
              amount: payment.amount,
              paymentCode: payment.paymentCode,
              paymentReference: payment.paymentReference,
              datePaid: payment.datePaid
            }
          });
        } else {
          console.log('❌ Paystack verification failed');
          console.log('   Expected statuses: success, paid, or completed');
          console.log('   Received original status:', originalStatus);
          console.log('   Cleaned status:', status);
          console.log('   Status type:', typeof status);
          console.log('   Status length:', status?.length);
          console.log('   Status char codes:', status ? [...status].map(c => c.charCodeAt(0)) : 'N/A');
          console.log('   Verification status:', verification.status);
          console.log('   Gateway response:', verification.data?.gateway_response);
          
          return res.status(400).json({
            success: false,
            message: `Payment verification failed. Original status: "${originalStatus}". Cleaned status: "${status}". Expected: success, paid, or completed. Please complete payment first or contact support.`,
            details: {
              originalStatus: originalStatus,
              cleanedStatus: status,
              statusType: typeof status,
              paystackStatus: verification.data?.status,
              gatewayResponse: verification.data?.gateway_response,
              expectedStatuses: ['success', 'paid', 'completed']
            }
          });
        }
      } catch (verifyError) {
        console.error('❌ PAYSTACK VERIFICATION ERROR');
        console.error('   Error type:', verifyError.name);
        console.error('   Error message:', verifyError.message);
        console.error('   Error stack:', verifyError.stack);
        
        if (verifyError.response) {
          console.error('   HTTP Status:', verifyError.response.status);
          console.error('   Response data:', verifyError.response.data);
          console.error('   Response headers:', verifyError.response.headers);
        } else if (verifyError.request) {
          console.error('   No response received from Paystack');
          console.error('   Request:', verifyError.request);
        }
        
        return res.status(500).json({
          success: false,
          message: 'Error verifying payment with Paystack. Please try again.',
          error: verifyError.message,
          details: verifyError.response?.data
        });
      }
    }

    // If payment status is failed or cancelled
    if (payment.status === 'failed' || payment.status === 'cancelled') {
      console.log('❌ Payment status is:', payment.status);
      return res.status(400).json({
        success: false,
        message: `Payment ${payment.status}. Please make a new payment.`
      });
    }

    // Unknown status
    console.log('⚠️ Unknown payment status:', payment.status);
    return res.status(400).json({
      success: false,
      message: `Invalid payment status: ${payment.status}. Please contact support.`
    });

  } catch (error) {
    console.error('❌ CRITICAL ERROR IN PAYMENT VERIFICATION');
    console.error('   Error name:', error.name);
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);
    console.error('   Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    return res.status(500).json({
      success: false,
      message: 'Server error during verification',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        stack: error.stack
      } : undefined
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
  handlePaystackCallback,
  verifyPaymentCode,
};
