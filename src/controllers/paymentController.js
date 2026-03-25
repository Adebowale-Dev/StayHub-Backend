const Payment = require('../models/Payment');
const Student = require('../models/Student');
const PaymentConfig = require('../models/PaymentConfig');
const paystackService = require('../services/paystackService');
const notificationService = require('../services/notificationService');
const cacheService = require('../services/cacheService');
const config = require('../config/env');
const { generateReference, generatePaymentCode } = require('../utils/generateCode');
const { getCurrentAcademicYear, getCurrentSemester } = require('../utils/dateUtils');

const getPaymentErrorStatus = (error) => error?.statusCode || 500;

const initializePayment = async (req, res) => {
    try {
        const student = req.user;
        if (student.paymentStatus === 'paid') {
            return res.status(400).json({
                success: false,
                message: 'You have already completed payment for this semester',
            });
        }
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
        const reference = generateReference('PAY');
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
        let payment = await Payment.findOne({
            student: student._id,
            status: 'pending',
        }).sort({ createdAt: -1 });
        if (payment) {
            payment.paymentReference = reference;
            payment.amount = paymentAmount;
            await payment.save();
        }
        else {
            payment = await Payment.create({
                student: student._id,
                amount: paymentAmount,
                paymentReference: reference,
                paymentCode: generatePaymentCode(),
                status: 'pending',
                semester: getCurrentSemester(),
                academicYear: getCurrentAcademicYear(),
            });
        }
        try {
            await notificationService.sendPaymentCode(student._id, payment.paymentCode, reference);
        }
        catch (emailError) {
            console.error('Failed to send payment code email:', emailError.message);
        }
        res.status(200).json({
            success: true,
            data: {
                authorizationUrl: paystackData.data.authorization_url,
                authorization_url: paystackData.data.authorization_url,
                reference: paystackData.data.reference,
                paymentCode: payment.paymentCode,
                amount: paymentAmount,
            },
        });
    }
    catch (error) {
        console.error('Initialize payment error:', error);
        res.status(getPaymentErrorStatus(error)).json({
            success: false,
            message: error.message || 'Failed to initialize payment',
        });
    }
};
const verifyPayment = async (req, res) => {
    try {
        const reference = req.params.reference || req.body.reference || req.query.reference;
        if (!reference) {
            return res.status(400).json({
                success: false,
                message: 'Payment reference is required',
            });
        }
        const verification = await paystackService.verifyTransaction(reference);
        if (!verification.success) {
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed',
            });
        }
        const paymentData = verification.data;
        const payment = await Payment.findOne({ paymentReference: reference });
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment record not found',
            });
        }
        if (payment.status === 'completed') {
            return res.status(200).json({
                success: true,
                message: 'Payment already verified',
                data: {
                    status: 'paid',
                    paymentStatus: 'paid',
                    amount: payment.amount,
                    paymentCode: payment.paymentCode,
                    paymentReference: payment.paymentReference,
                    reference: payment.paymentReference,
                    paidAt: payment.datePaid,
                    datePaid: payment.datePaid,
                },
            });
        }
        if (paymentData.status === 'success') {
            payment.status = 'completed';
            payment.datePaid = new Date();
            payment.paystackResponse = paymentData;
            await payment.save();
            const student = await Student.findById(payment.student);
            student.paymentStatus = 'paid';
            student.paymentReference = reference;
            student.paymentCode = payment.paymentCode;
            await student.save();
            await notificationService.notifyPaymentSuccess(student._id, payment);
            res.status(200).json({
                success: true,
                message: 'Payment verified successfully',
                data: {
                    status: 'paid',
                    paymentStatus: 'paid',
                    paymentCode: payment.paymentCode,
                    amount: payment.amount,
                    reference: payment.paymentReference,
                    paymentReference: payment.paymentReference,
                    paidAt: payment.datePaid,
                    datePaid: payment.datePaid,
                },
            });
        }
        else {
            payment.status = 'failed';
            payment.paystackResponse = paymentData;
            await payment.save();
            res.status(400).json({
                success: false,
                message: 'Payment failed',
            });
        }
    }
    catch (error) {
        console.error('Verify payment error:', error);
        res.status(getPaymentErrorStatus(error)).json({
            success: false,
            message: error.message || 'Failed to verify payment',
        });
    }
};
const getPaymentStatus = async (req, res) => {
    try {
        const student = req.user;
        const latestPayment = await Payment.findOne({ student: student._id })
            .sort({ createdAt: -1 });
        let amount = cacheService.get(cacheService.cacheKeys.paymentAmount());
        if (!amount) {
            const paymentConfig = await PaymentConfig.findOne({});
            amount = paymentConfig ? paymentConfig.amount : null;
            if (amount)
                cacheService.set(cacheService.cacheKeys.paymentAmount(), amount);
        }
        res.status(200).json({
            success: true,
            status: student.paymentStatus,
            paymentStatus: student.paymentStatus,
            amount: latestPayment ? latestPayment.amount : amount || null,
            reference: latestPayment ? latestPayment.paymentReference : null,
            paymentReference: latestPayment ? latestPayment.paymentReference : null,
            paidAt: latestPayment && latestPayment.status === 'completed' ? latestPayment.datePaid : null,
            datePaid: latestPayment && latestPayment.status === 'completed' ? latestPayment.datePaid : null,
            data: {
                status: student.paymentStatus,
                paymentStatus: student.paymentStatus,
                amount: latestPayment ? latestPayment.amount : amount || null,
                reference: latestPayment ? latestPayment.paymentReference : null,
                paymentReference: latestPayment ? latestPayment.paymentReference : null,
                paidAt: latestPayment && latestPayment.status === 'completed' ? latestPayment.datePaid : null,
                datePaid: latestPayment && latestPayment.status === 'completed' ? latestPayment.datePaid : null,
            },
        });
    }
    catch (error) {
        console.error('Get payment status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment status',
        });
    }
};
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
        const config = await PaymentConfig.findOneAndUpdate({}, {
            amount,
            semester: semester || getCurrentSemester(),
            academicYear: academicYear || getCurrentAcademicYear(),
            updatedBy: req.user?._id,
        }, { upsert: true, new: true });
        const updateResult = await Payment.updateMany({ status: { $in: ['pending', 'failed'] } }, { $set: { amount: amount } });
        console.log(`Updated ${updateResult.modifiedCount} existing pending/failed payments`);
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
    }
    catch (error) {
        console.error('Set payment amount error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update payment amount',
            error: error.message,
        });
    }
};
const getPaymentAmount = async (req, res) => {
    try {
        let amount = cacheService.get(cacheService.cacheKeys.paymentAmount());
        if (!amount) {
            const config = await PaymentConfig.findOne({});
            if (!config) {
                return res.status(404).json({
                    success: false,
                    message: 'Payment amount not configured yet',
                });
            }
            amount = config.amount;
            cacheService.set(cacheService.cacheKeys.paymentAmount(), amount);
        }
        res.status(200).json({
            success: true,
            data: { amount },
            amount,
        });
    }
    catch (error) {
        console.error('Get payment amount error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment amount',
        });
    }
};
const getAllPayments = async (req, res) => {
    try {
        const { status, semester, academicYear, page = 1, limit = 50 } = req.query;
        const query = {};
        if (status)
            query.status = status;
        if (semester)
            query.semester = semester;
        if (academicYear)
            query.academicYear = academicYear;
        const payments = await Payment.find(query)
            .populate('student', 'firstName lastName matricNo email level')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();
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
    }
    catch (error) {
        console.error('Get all payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payments',
        });
    }
};
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
        delete result._id;
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error('Get payment stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment statistics',
        });
    }
};
const handlePaystackCallback = async (req, res) => {
    try {
        const { reference, trxref } = req.query;
        const paymentReference = reference || trxref;
        console.log('📞 Paystack callback received. Reference:', paymentReference);
        if (!paymentReference) {
            return res.redirect(`${config.FRONTEND_URL}/student/payment?status=error&message=No payment reference provided`);
        }
        console.log('🔍 Verifying transaction with Paystack...');
        const verification = await paystackService.verifyTransaction(paymentReference);
        if (!verification.success) {
            console.log('❌ Paystack verification failed');
            return res.redirect(`${config.FRONTEND_URL}/student/payment?status=failed&reference=${paymentReference}`);
        }
        const paymentData = verification.data;
        console.log('✅ Paystack verification successful. Status:', paymentData.status);
        const payment = await Payment.findOne({ paymentReference });
        if (!payment) {
            console.log('❌ Payment record not found in database');
            return res.redirect(`${config.FRONTEND_URL}/student/payment?status=error&message=Payment record not found`);
        }
        if (paymentData.status === 'success') {
            console.log('💰 Payment successful on Paystack');
            payment.status = 'pending';
            payment.paystackResponse = paymentData;
            await payment.save();
            const student = await Student.findById(payment.student);
            console.log('📧 Sending payment code to student email:', student.email);
            await notificationService.sendPaymentCode(student._id, payment.paymentCode, paymentReference);
            console.log('✅ Payment code sent. Redirecting to verification page...');
            return res.redirect(`${config.FRONTEND_URL}/student/payment/verify?reference=${paymentReference}&message=Payment successful! Check your email for the verification code`);
        }
        else {
            console.log('❌ Payment failed on Paystack. Status:', paymentData.status);
            payment.status = 'failed';
            payment.paystackResponse = paymentData;
            await payment.save();
            return res.redirect(`${config.FRONTEND_URL}/student/payment?status=failed&reference=${paymentReference}`);
        }
    }
    catch (error) {
        console.error('❌ Paystack callback error:', error);
        return res.redirect(`${config.FRONTEND_URL}/student/payment?status=error&message=${encodeURIComponent(error.message || 'Payment verification failed')}`);
    }
};
const verifyPaymentCode = async (req, res) => {
    try {
        console.log('📥 Payment verification request received:', {
            body: req.body,
            hasUser: !!req.user,
            userId: req.user?._id
        });
        const { paymentCode } = req.body;
        const studentId = req.user?._id;
        if (!req.user || !studentId) {
            console.log('❌ No authenticated user found');
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
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
            const studentPayments = await Payment.find({ student: studentId })
                .select('paymentCode status paymentReference createdAt')
                .sort({ createdAt: -1 })
                .limit(5);
            console.log('   Student has these recent payments:');
            studentPayments.forEach(p => {
                console.log(`      - Code: ${p.paymentCode} | Status: ${p.status} | Ref: ${p.paymentReference}`);
            });
            const anyPayment = await Payment.findOne({
                paymentCode: paymentCode.toUpperCase()
            }).select('student paymentCode');
            if (anyPayment) {
                console.log('⚠️ Code exists but belongs to different student:', anyPayment.student);
            }
            else {
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
        if (payment.status === 'completed') {
            console.log('✅ Payment already verified');
            return res.json({
                success: true,
                message: 'Payment already verified',
                data: {
                    status: 'paid',
                    paymentStatus: 'paid',
                    amount: payment.amount,
                    paymentCode: payment.paymentCode,
                    paymentReference: payment.paymentReference,
                    reference: payment.paymentReference,
                    paidAt: payment.datePaid,
                    datePaid: payment.datePaid
                }
            });
        }
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
                let status = paystackData?.status;
                const originalStatus = status;
                if (typeof status === 'string') {
                    status = status.trim().replace(/^["']|["']$/g, '').toLowerCase();
                }
                console.log('🔍 Status cleaning:');
                console.log('   Original status:', originalStatus);
                console.log('   Cleaned status:', status);
                console.log('   Type after cleaning:', typeof status);
                console.log('   Length after cleaning:', status?.length);
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
                    payment.status = 'completed';
                    payment.datePaid = new Date();
                    payment.paystackResponse = verification.data;
                    await payment.save();
                    console.log('✅ Step 8: Payment record updated');
                    await Student.findByIdAndUpdate(studentId, {
                        paymentStatus: 'paid'
                    });
                    console.log('✅ Step 9: Student payment status updated');
                    return res.json({
                        success: true,
                        message: 'Payment verified successfully',
                        data: {
                            status: 'paid',
                            paymentStatus: 'paid',
                            amount: payment.amount,
                            paymentCode: payment.paymentCode,
                            paymentReference: payment.paymentReference,
                            reference: payment.paymentReference,
                            paidAt: payment.datePaid,
                            datePaid: payment.datePaid
                        }
                    });
                }
                else {
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
            }
            catch (verifyError) {
                console.error('❌ PAYSTACK VERIFICATION ERROR');
                console.error('   Error type:', verifyError.name);
                console.error('   Error message:', verifyError.message);
                console.error('   Error stack:', verifyError.stack);
                if (verifyError.response) {
                    console.error('   HTTP Status:', verifyError.response.status);
                    console.error('   Response data:', verifyError.response.data);
                    console.error('   Response headers:', verifyError.response.headers);
                }
                else if (verifyError.request) {
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
        if (payment.status === 'failed' || payment.status === 'cancelled') {
            console.log('❌ Payment status is:', payment.status);
            return res.status(400).json({
                success: false,
                message: `Payment ${payment.status}. Please make a new payment.`
            });
        }
        console.log('⚠️ Unknown payment status:', payment.status);
        return res.status(400).json({
            success: false,
            message: `Invalid payment status: ${payment.status}. Please contact support.`
        });
    }
    catch (error) {
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
const resendPaymentCode = async (req, res) => {
    try {
        const student = req.user;
        if (student.paymentStatus === 'paid') {
            return res.status(400).json({
                success: false,
                message: 'Your payment is already verified',
            });
        }
        const payment = await Payment.findOne({
            student: student._id,
            status: 'pending',
        }).sort({ createdAt: -1 });
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'No pending payment found. Please initialize a payment first.',
            });
        }
        await notificationService.sendPaymentCode(student._id, payment.paymentCode, payment.paymentReference);
        res.status(200).json({
            success: true,
            message: 'Payment code has been sent to your email',
        });
    }
    catch (error) {
        console.error('Resend payment code error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resend payment code',
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
    resendPaymentCode,
};
