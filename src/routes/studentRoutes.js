const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { protect } = require('../middlewares/authMiddleware');
const { studentOnly, checkStudentPayment } = require('../middlewares/roleMiddleware');
const { validateReservation } = require('../middlewares/validationMiddleware');

/**
 * @swagger
 * tags:
 *   name: Student
 *   description: Student operations and room reservations
 */

// Apply auth middleware
router.use(protect, studentOnly);

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
 *               - bunkId
 *             properties:
 *               bunkId:
 *                 type: string
 *                 description: Bunk ID to reserve
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
router.post('/reserve', checkStudentPayment, validateReservation, studentController.reserveRoom);

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

module.exports = router;
