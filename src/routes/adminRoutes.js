const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminController = require('../controllers/adminController');
const { protect } = require('../middlewares/authMiddleware');
const { adminOnly } = require('../middlewares/roleMiddleware');
const {
  validateCollege,
  validateDepartment,
  validateStudent,
  validateHostel,
  validateRoom,
  validateMongoId,
} = require('../middlewares/validationMiddleware');

// Setup multer for file uploads
const upload = multer({ dest: 'uploads/' });

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin management endpoints
 */

// Apply auth middleware
router.use(protect, adminOnly);

/**
 * @swagger
 * /api/admin/search:
 *   get:
 *     summary: Universal search across all entities
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (matric no, name, email, phone, code, etc.)
 *         example: BU22CSC1005
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, students, colleges, departments, hostels, rooms, porters]
 *           default: all
 *         description: Type of entity to search
 *       - in: query
 *         name: college
 *         schema:
 *           type: string
 *         description: Filter by college ID
 *       - in: query
 *         name: level
 *         schema:
 *           type: number
 *           enum: [100, 200, 300, 400, 500]
 *         description: Filter by student level
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [paid, unpaid, reserved, checked_in, approved, pending, available, full]
 *         description: Filter by status
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
 *           default: 20
 *         description: Results per page
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 query:
 *                   type: string
 *                 type:
 *                   type: string
 *                 totalResults:
 *                   type: number
 *                 results:
 *                   type: object
 *                   properties:
 *                     students:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Student'
 *                     studentsCount:
 *                       type: number
 *                     colleges:
 *                       type: array
 *                     collegesCount:
 *                       type: number
 *                     departments:
 *                       type: array
 *                     departmentsCount:
 *                       type: number
 *                     hostels:
 *                       type: array
 *                     hostelsCount:
 *                       type: number
 *                     rooms:
 *                       type: array
 *                     roomsCount:
 *                       type: number
 *                     porters:
 *                       type: array
 *                     portersCount:
 *                       type: number
 *       400:
 *         description: Search query required
 *       403:
 *         description: Admin access required
 */
router.get('/search', adminController.search);

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 */
router.get('/dashboard', adminController.getDashboardStats);

/**
 * @swagger
 * /api/admin/colleges:
 *   post:
 *     summary: Create a new college
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - code
 *             properties:
 *               name:
 *                 type: string
 *                 example: College of Computing and Communication Studies
 *               code:
 *                 type: string
 *                 example: COCCS
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: College created successfully
 *   get:
 *     summary: Get all colleges
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all colleges
 */
router.post('/colleges', validateCollege, adminController.createCollege);
router.get('/colleges', adminController.getColleges);

/**
 * @swagger
 * /api/admin/colleges/{id}:
 *   put:
 *     summary: Update a college
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: College ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: College updated successfully
 *   delete:
 *     summary: Delete a college
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: College deleted successfully
 */
router.put('/colleges/:id', validateMongoId('id'), validateCollege, adminController.updateCollege);
router.delete('/colleges/:id', validateMongoId('id'), adminController.deleteCollege);

/**
 * @swagger
 * /api/admin/departments:
 *   post:
 *     summary: Create a new department
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - code
 *               - college
 *             properties:
 *               name:
 *                 type: string
 *                 example: Computer Science
 *               code:
 *                 type: string
 *                 example: CSC
 *               college:
 *                 type: string
 *                 description: College ID
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Department created successfully
 *   get:
 *     summary: Get all departments
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all departments
 */
router.post('/departments', validateDepartment, adminController.createDepartment);
router.get('/departments', adminController.getDepartments);

/**
 * @swagger
 * /api/admin/students:
 *   post:
 *     summary: Create a new student
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - matricNo
 *               - email
 *               - level
 *               - college
 *               - department
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               matricNo:
 *                 type: string
 *                 example: BU22CSC1001
 *               email:
 *                 type: string
 *               level:
 *                 type: number
 *                 example: 100
 *               college:
 *                 type: string
 *               department:
 *                 type: string
 *     responses:
 *       201:
 *         description: Student created successfully
 *   get:
 *     summary: Get all students
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all students
 */
router.post('/students', validateStudent, adminController.createStudent);

/**
 * @swagger
 * /api/admin/students/bulk-upload:
 *   post:
 *     summary: Bulk upload students via CSV
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Students uploaded successfully
 */
router.post('/students/bulk-upload', upload.single('file'), adminController.bulkUploadStudents);
router.get('/students', adminController.getStudents);

/**
 * @swagger
 * /api/admin/hostels:
 *   post:
 *     summary: Create a new hostel
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - gender
 *               - allowedLevels
 *             properties:
 *               name:
 *                 type: string
 *                 example: Kings Hostel
 *               gender:
 *                 type: string
 *                 enum: [male, female, mixed]
 *               allowedLevels:
 *                 type: array
 *                 items:
 *                   type: number
 *                 example: [100, 200, 300, 400]
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Hostel created successfully
 *   get:
 *     summary: Get all hostels
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all hostels
 */
router.post('/hostels', validateHostel, adminController.createHostel);
router.get('/hostels', adminController.getHostels);

/**
 * @swagger
 * /api/admin/rooms:
 *   post:
 *     summary: Create a new room
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomNumber
 *               - hostel
 *               - capacity
 *             properties:
 *               roomNumber:
 *                 type: string
 *                 example: A101
 *               hostel:
 *                 type: string
 *               capacity:
 *                 type: number
 *                 example: 4
 *     responses:
 *       201:
 *         description: Room created successfully
 *   get:
 *     summary: Get all rooms
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all rooms
 */
router.post('/rooms', validateRoom, adminController.createRoom);
router.get('/rooms', adminController.getRooms);

/**
 * @swagger
 * /api/admin/porters/approve:
 *   post:
 *     summary: Approve a porter application
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - porterId
 *             properties:
 *               porterId:
 *                 type: string
 *               assignedHostel:
 *                 type: string
 *     responses:
 *       200:
 *         description: Porter approved successfully
 */
router.post('/porters/approve', adminController.approvePorter);

/**
 * @swagger
 * /api/admin/porters:
 *   get:
 *     summary: Get all porters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all porters
 */
router.get('/porters', adminController.getPorters);

module.exports = router;
