const express = require('express');
const router = express.Router();
const porterController = require('../controllers/porterController');
const { protect, checkFirstLogin } = require('../middlewares/authMiddleware');
const { porterOnly, checkPorterApproval, checkPorterHostel } = require('../middlewares/roleMiddleware');
const { validatePorterApplication } = require('../middlewares/validationMiddleware');

/**
 * @swagger
 * tags:
 *   name: Porter
 *   description: Porter application and hostel management operations
 */

/**
 * @swagger
 * /api/porter/apply:
 *   post:
 *     summary: Apply to become a porter
 *     tags: [Porter]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - phoneNumber
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
 *                 example: porter@example.com
 *               phoneNumber:
 *                 type: string
 *                 example: "+2348012345678"
 *               address:
 *                 type: string
 *                 example: "123 Main St, Lagos"
 *     responses:
 *       201:
 *         description: Porter application submitted successfully
 *       400:
 *         description: Validation error or porter already exists
 */
router.post('/apply', validatePorterApplication, porterController.applyAsPorter);

// Protected routes
router.use(protect, porterOnly, checkFirstLogin, checkPorterApproval);

/**
 * @swagger
 * /api/porter/dashboard:
 *   get:
 *     summary: Get porter dashboard with statistics
 *     tags: [Porter]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Porter dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       403:
 *         description: Porter not approved or no hostel assigned
 */
router.get('/dashboard', porterController.getDashboard);

// Routes that require hostel assignment
router.use(checkPorterHostel);

/**
 * @swagger
 * /api/porter/students:
 *   get:
 *     summary: Get all students in porter's hostel
 *     tags: [Porter]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of students in hostel
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 students:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Student'
 *       403:
 *         description: No hostel assigned to porter
 */
router.get('/students', porterController.getStudents);

/**
 * @swagger
 * /api/porter/rooms:
 *   get:
 *     summary: Get all rooms in porter's hostel
 *     tags: [Porter]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of rooms in hostel
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 rooms:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Room'
 *       403:
 *         description: No hostel assigned to porter
 */
router.get('/rooms', porterController.getRooms);

/**
 * @swagger
 * /api/porter/checkin/{studentId}:
 *   post:
 *     summary: Check in a student to their assigned room
 *     tags: [Porter]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ID to check in
 *     responses:
 *       200:
 *         description: Student checked in successfully
 *       400:
 *         description: Student not reserved or already checked in
 *       404:
 *         description: Student not found
 */
router.post('/checkin/:studentId', porterController.checkInStudent);

/**
 * @swagger
 * /api/porter/release-expired:
 *   post:
 *     summary: Release all expired reservations in hostel
 *     tags: [Porter]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Expired reservations released successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 releasedCount:
 *                   type: number
 */
router.post('/release-expired', porterController.releaseExpiredReservations);

module.exports = router;
