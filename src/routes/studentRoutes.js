const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middlewares/authMiddleware');
const { studentOnly, checkStudentPayment } = require('../middlewares/roleMiddleware');
const { validateReservation } = require('../middlewares/validationMiddleware');
const { uploadProfilePicture } = require('../middlewares/uploadMiddleware');

/**
 * @swagger
 * tags:
 *   name: Student
 *   description: Student operations and room reservations
 */

/**
 * @swagger
 * /api/student/payment/verify/{reference}:
 *   get:
 *     summary: Verify payment after Paystack redirect (Public endpoint)
 *     tags: [Student]
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentCode:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     reference:
 *                       type: string
 *                     datePaid:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Payment verification failed
 *       404:
 *         description: Payment record not found
 */
// Public endpoint - Must be before auth middleware
router.get('/payment/verify/:reference', paymentController.verifyPayment);

// Apply auth middleware to all routes below
router.use(protect, studentOnly);

/**
 * @swagger
 * /api/student/profile:
 *   patch:
 *     summary: Update student profile
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               phoneNumber:
 *                 type: string
 *                 example: "08012345678"
 *               department:
 *                 type: string
 *                 description: Department ID
 *               level:
 *                 type: number
 *                 enum: [100, 200, 300, 400, 500]
 *                 example: 200
 *               matricNumber:
 *                 type: string
 *                 example: BU22CSC1061
 *               gender:
 *                 type: string
 *                 enum: [male, female]
 *                 example: male
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *       400:
 *         description: Validation error
 */
router.patch('/profile', studentController.updateProfile);

/**
 * @swagger
 * /api/student/profile/picture:
 *   post:
 *     summary: Upload or replace profile picture
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - picture
 *             properties:
 *               picture:
 *                 type: string
 *                 format: binary
 *                 description: JPEG, PNG, or WebP image (max 5 MB)
 *     responses:
 *       200:
 *         description: Profile picture updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     student:
 *                       type: object
 *       400:
 *         description: Missing file or invalid type / size
 */
router.post('/profile/picture', uploadProfilePicture, studentController.uploadProfilePicture);

/**
 * @swagger
 * /api/student/dashboard:
 *   get:
 *     summary: Get student dashboard
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Student dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 */
router.get('/dashboard', studentController.getDashboard);

/**
 * @swagger
 * /api/student/alerts:
 *   get:
 *     summary: Get contextual alerts for the student
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active alerts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "1"
 *                       type:
 *                         type: string
 *                         enum: [warning, info, error]
 *                         example: warning
 *                       icon:
 *                         type: string
 *                         description: MaterialCommunityIcons name
 *                         example: clock-alert-outline
 *                       message:
 *                         type: string
 *                         example: "Reservation expires in 18h"
 */
router.get('/alerts', studentController.getAlerts);

/**
 * @swagger
 * /api/student/hostels:
 *   get:
 *     summary: Get available hostels for student's level
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available hostels
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 hostels:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/hostels', studentController.getAvailableHostels);

/**
 * @swagger
 * /api/student/hostels/{hostelId}/rooms:
 *   get:
 *     summary: Get available rooms in a hostel
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hostelId
 *         required: true
 *         schema:
 *           type: string
 *         description: Hostel ID
 *     responses:
 *       200:
 *         description: List of available rooms
 */
router.get('/hostels/:hostelId/rooms', studentController.getAvailableRooms);

/**
 * @swagger
 * /api/student/rooms/{roomId}/bunks:
 *   get:
 *     summary: Get available bunks in a room
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     responses:
 *       200:
 *         description: List of available bunks
 */
router.get('/rooms/:roomId/bunks', studentController.getAvailableBunks);

/**
 * @swagger
 * /api/student/reserve:
 *   post:
 *     summary: Reserve a room/bunk (requires payment)
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomId
 *             properties:
 *               roomId:
 *                 type: string
 *                 description: Room ID to reserve
 *               bunkId:
 *                 type: string
 *                 description: Optional specific bunk ID (auto-selected if not provided)
 *               roommates:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of student IDs to be roommates
 *     responses:
 *       200:
 *         description: Reservation successful
 *       403:
 *         description: Payment required
 */
router.post('/reserve', validateReservation, studentController.reserveRoom);

/**
 * @swagger
 * /api/student/reservations:
 *   post:
 *     summary: Create room reservation (alternative endpoint)
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomId
 *               - hostelId
 *             properties:
 *               roomId:
 *                 type: string
 *               hostelId:
 *                 type: string
 *               friends:
 *                 type: array
 *                 items:
 *                   type: string
 *               isGroupReservation:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Reservation created successfully
 *       400:
 *         description: Invalid request or insufficient space
 *       403:
 *         description: Payment required
 */
router.post('/reservations', studentController.createReservation);

/**
 * @swagger
 * /api/student/reservation:
 *   get:
 *     summary: Get current reservation details
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reservation details
 *       404:
 *         description: No reservation found
 */
router.get('/reservation', studentController.getReservation);

/**
 * @swagger
 * /api/student/reservation/members:
 *   post:
 *     summary: Add members to an existing reservation by matric number
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - matrics
 *             properties:
 *               matrics:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of matric numbers to add to the reservation
 *                 example: ["BU22CSC1061", "BU22CSC1062"]
 *     responses:
 *       200:
 *         description: Members added successfully
 *       400:
 *         description: Validation error (no reservation, already in room, insufficient space, etc.)
 *       404:
 *         description: Matric number(s) not found
 */
router.post('/reservation/members', studentController.addGroupMembers);

/**
 * @swagger
 * /api/student/payment/amount:
 *   get:
 *     summary: Get current hostel payment amount
 *     tags: [Student]
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
 *                   example: 10000
 *       404:
 *         description: Payment amount not set
 */
router.get('/payment/amount', paymentController.getPaymentAmount);

/**
 * @swagger
 * /api/student/payment/status:
 *   get:
 *     summary: Get student's payment status
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     amount:
 *                       type: number
 *                     status:
 *                       type: string
 *                       enum: [pending, paid]
 *                     reference:
 *                       type: string
 *                     paidAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: No payment found
 */
router.get('/payment/status', paymentController.getPaymentStatus);

/**
 * @swagger
 * /api/student/payment/initialize:
 *   post:
 *     summary: Initialize payment with Paystack
 *     tags: [Student]
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
 *                 description: Optional custom amount
 *                 example: 10000
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     reference:
 *                       type: string
 *                     authorizationUrl:
 *                       type: string
 *                     accessCode:
 *                       type: string
 *       400:
 *         description: Already paid or payment amount not set
 */
router.post('/payment/initialize', paymentController.initializePayment);

/**
 * @swagger
 * /api/student/payment/verify-code:
 *   post:
 *     summary: Verify payment using payment code
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentCode
 *             properties:
 *               paymentCode:
 *                 type: string
 *                 description: 6-character payment code
 *                 example: ABC123
 *     responses:
 *       200:
 *         description: Payment verified successfully
 *       400:
 *         description: Payment verification failed
 *       404:
 *         description: Invalid payment code
 */
router.post('/payment/verify-code', paymentController.verifyPaymentCode);

router.post('/payment/resend-code', paymentController.resendPaymentCode);

module.exports = router;
