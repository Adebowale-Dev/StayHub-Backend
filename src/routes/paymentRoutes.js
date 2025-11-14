const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middlewares/authMiddleware');
const { adminOnly, studentOnly, restrictTo } = require('../middlewares/roleMiddleware');

/**
 * @swagger
 * tags:
 *   name: Payment
 *   description: Payment processing with Paystack integration
 */

/**
 * @swagger
 * /api/payment/verify/{reference}:
 *   get:
 *     summary: Verify payment from Paystack callback
 *     tags: [Payment]
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema:
 *           type: string
 *         description: Paystack payment reference
 *     responses:
 *       200:
 *         description: Payment verified successfully
 *       400:
 *         description: Payment verification failed
 */
router.get('/verify/:reference', paymentController.verifyPayment);

// Protected routes
router.use(protect);

/**
 * @swagger
 * /api/payment/amount:
 *   get:
 *     summary: Get current hostel payment amount
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current payment amount
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 amount:
 *                   type: number
 *                   example: 25000
 *       404:
 *         description: Payment amount not set
 */
router.get('/amount', paymentController.getPaymentAmount);

// Student routes

/**
 * @swagger
 * /api/payment/initialize:
 *   post:
 *     summary: Initialize payment with Paystack
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Optional custom amount (uses default if not provided)
 *                 example: 25000
 *     responses:
 *       200:
 *         description: Payment initialized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 authorizationUrl:
 *                   type: string
 *                   description: Paystack payment URL
 *                 reference:
 *                   type: string
 *                   description: Payment reference
 *       400:
 *         description: Payment amount not set or already paid
 */
router.post('/initialize', studentOnly, paymentController.initializePayment);

/**
 * @swagger
 * /api/payment/status:
 *   get:
 *     summary: Get student's payment status
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       404:
 *         description: No payment found
 */
router.get('/status', studentOnly, paymentController.getPaymentStatus);

// Admin routes

/**
 * @swagger
 * /api/payment/set-amount:
 *   post:
 *     summary: Set hostel payment amount (Admin only)
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 25000
 *                 description: Hostel payment amount in Naira
 *     responses:
 *       200:
 *         description: Payment amount set successfully
 *       400:
 *         description: Invalid amount
 *       403:
 *         description: Admin access required
 */
router.post('/set-amount', adminOnly, paymentController.setPaymentAmount);

/**
 * @swagger
 * /api/payment:
 *   get:
 *     summary: Get all payments (Admin only)
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, success, failed]
 *         description: Filter by payment status
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 10
 *         description: Results per page
 *     responses:
 *       200:
 *         description: List of payments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 payments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Payment'
 *       403:
 *         description: Admin access required
 */
router.get('/', adminOnly, paymentController.getAllPayments);

/**
 * @swagger
 * /api/payment/stats:
 *   get:
 *     summary: Get payment statistics (Admin only)
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalPayments:
 *                       type: number
 *                     successfulPayments:
 *                       type: number
 *                     pendingPayments:
 *                       type: number
 *                     failedPayments:
 *                       type: number
 *                     totalRevenue:
 *                       type: number
 *       403:
 *         description: Admin access required
 */
router.get('/stats', adminOnly, paymentController.getPaymentStats);

module.exports = router;
