const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminController = require('../controllers/adminController');
const paymentController = require('../controllers/paymentController');
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
                 stats:
                   type: object
 */
router.get('/dashboard', adminController.getDashboardStats);

/**
 * @swagger
 * /api/admin/colleges/statistics:
 *   get:
 *     summary: Get college statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: College statistics retrieved successfully
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
 *                     totalColleges:
 *                       type: number
 *                       example: 5
 *                     activeColleges:
 *                       type: number
 *                       example: 5
 *                     inactiveColleges:
 *                       type: number
 *                       example: 0
 *                     totalDepartments:
 *                       type: number
 *                       example: 25
 *                     totalStudents:
 *                       type: number
 *                       example: 500
 *                     collegesBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           code:
 *                             type: string
 *                           departmentCount:
 *                             type: number
 *                           studentCount:
 *                             type: number
 *                           isActive:
 *                             type: boolean
 *       403:
 *         description: Admin access required
 */
router.get('/colleges/statistics', adminController.getCollegeStatistics);

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
 * /api/admin/colleges/{collegeId}/departments:
 *   post:
 *     summary: Create a new department in a college
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collegeId
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
 *             required:
 *               - name
 *               - code
 *             properties:
 *               name:
 *                 type: string
 *                 example: Computer Science
 *               code:
 *                 type: string
 *                 example: CSC
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Department created successfully
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
 *                     department:
 *                       type: object
 *                     college:
 *                       type: object
 *       404:
 *         description: College not found
 *       409:
 *         description: Department already exists
 *   get:
 *     summary: Get all departments in a college
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collegeId
 *         required: true
 *         schema:
 *           type: string
 *         description: College ID
 *     responses:
 *       200:
 *         description: List of all departments with student counts
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
 *                     college:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         code:
 *                           type: string
 *                     departments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           code:
 *                             type: string
 *                           studentCount:
 *                             type: number
 *                     total:
 *                       type: number
 *       404:
 *         description: College not found
 */
router.post('/colleges/:collegeId/departments', validateMongoId('collegeId'), validateDepartment, adminController.createDepartment);
router.get('/colleges/:collegeId/departments', validateMongoId('collegeId'), adminController.getDepartments);

/**
 * @swagger
 * /api/admin/colleges/{collegeId}/departments/{deptId}:
 *   put:
 *     summary: Update a department
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collegeId
 *         required: true
 *         schema:
 *           type: string
 *         description: College ID
 *       - in: path
 *         name: deptId
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ID
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
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Department updated successfully
 *       404:
 *         description: College or department not found
 *       409:
 *         description: Duplicate department name or code
 *   delete:
 *     summary: Delete a department
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collegeId
 *         required: true
 *         schema:
 *           type: string
 *         description: College ID
 *       - in: path
 *         name: deptId
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ID
 *       - in: query
 *         name: force
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: false
 *         description: Force delete even if department has students
 *     responses:
 *       200:
 *         description: Department deleted successfully
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
 *                     deletedDepartment:
 *                       type: object
 *                     deletedStudents:
 *                       type: number
 *       400:
 *         description: Cannot delete department with students (use force=true)
 *       404:
 *         description: College or department not found
 */
router.put('/colleges/:collegeId/departments/:deptId', validateMongoId('collegeId'), validateMongoId('deptId'), adminController.updateDepartment);
router.delete('/colleges/:collegeId/departments/:deptId', validateMongoId('collegeId'), validateMongoId('deptId'), adminController.deleteDepartment);

/**
 * @swagger
 * /api/admin/colleges/{collegeId}/students:
 *   get:
 *     summary: Get all students in a college
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collegeId
 *         required: true
 *         schema:
 *           type: string
 *         description: College ID
 *       - in: query
 *         name: level
 *         schema:
 *           type: number
 *           enum: [100, 200, 300, 400, 500]
 *         description: Filter by level
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department ID
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [pending, paid, failed]
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
 *           default: 50
 *         description: Results per page
 *     responses:
 *       200:
 *         description: List of students in the college
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
 *                     college:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         code:
 *                           type: string
 *                     students:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Student'
 *                     totalPages:
 *                       type: number
 *                     currentPage:
 *                       type: number
 *                     total:
 *                       type: number
 *       404:
 *         description: College not found
 */
router.get('/colleges/:collegeId/students', validateMongoId('collegeId'), adminController.getStudentsByCollege);

/**
 * @swagger
 * /api/admin/colleges/{collegeId}/departments/{deptId}/students:
 *   get:
 *     summary: Get all students in a department
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: collegeId
 *         required: true
 *         schema:
 *           type: string
 *         description: College ID
 *       - in: path
 *         name: deptId
 *         required: true
 *         schema:
 *           type: string
 *         description: Department ID
 *       - in: query
 *         name: level
 *         schema:
 *           type: number
 *           enum: [100, 200, 300, 400, 500]
 *         description: Filter by level
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [pending, paid, failed]
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
 *           default: 50
 *         description: Results per page
 *     responses:
 *       200:
 *         description: List of students in the department
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
 *                     college:
 *                       type: object
 *                     department:
 *                       type: object
 *                     students:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Student'
 *                     totalPages:
 *                       type: number
 *                     currentPage:
 *                       type: number
 *                     total:
 *                       type: number
 *       404:
 *         description: College or department not found
 */
router.get('/colleges/:collegeId/departments/:deptId/students', validateMongoId('collegeId'), validateMongoId('deptId'), adminController.getStudentsByDepartment);

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
 *               - gender
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
 *               gender:
 *                 type: string
 *                 enum: [male, female]
 *                 example: male
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
 *     description: Upload a CSV file with columns - firstName, lastName, matricNo, email, level, gender (male/female), college (ID), department (ID)
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
 *                 description: CSV file with columns - firstName, lastName, matricNo, email, level, gender, college, department
 *     responses:
 *       201:
 *         description: Students uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.post('/students/bulk-upload', upload.single('file'), adminController.bulkUploadStudents);
router.get('/students', adminController.getStudents);

/**
 * @swagger
 * /api/admin/students/male:
 *   get:
 *     summary: Get all male students
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: number
 *         description: Filter by academic level (100, 200, 300, 400, 500)
 *       - in: query
 *         name: college
 *         schema:
 *           type: string
 *         description: Filter by college ID
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department ID
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [pending, paid, failed]
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
 *           default: 50
 *         description: Results per page
 *     responses:
 *       200:
 *         description: List of male students
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 gender:
 *                   type: string
 *                   example: male
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Student'
 *                 totalPages:
 *                   type: number
 *                 currentPage:
 *                   type: number
 *                 total:
 *                   type: number
 */
router.get('/students/male', adminController.getMaleStudents);

/**
 * @swagger
 * /api/admin/students/female:
 *   get:
 *     summary: Get all female students
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: number
 *         description: Filter by academic level (100, 200, 300, 400, 500)
 *       - in: query
 *         name: college
 *         schema:
 *           type: string
 *         description: Filter by college ID
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department ID
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [pending, paid, failed]
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
 *           default: 50
 *         description: Results per page
 *     responses:
 *       200:
 *         description: List of female students
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 gender:
 *                   type: string
 *                   example: female
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Student'
 *                 totalPages:
 *                   type: number
 *                 currentPage:
 *                   type: number
 *                 total:
 *                   type: number
 */
router.get('/students/female', adminController.getFemaleStudents);

/**
 * @swagger
 * /api/admin/students/{id}:
 *   put:
 *     summary: Update student details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ID
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
 *                 example: john.doe@university.edu
 *               matricNo:
 *                 type: string
 *                 example: STU20240002
 *               phoneNumber:
 *                 type: string
 *                 example: +2348012345678
 *               level:
 *                 type: number
 *                 example: 200
 *               gender:
 *                 type: string
 *                 enum: [male, female]
 *                 description: Student gender (cannot be changed if assigned to non-mixed hostel)
 *                 example: male
 *               college:
 *                 type: string
 *                 description: College ID
 *               department:
 *                 type: string
 *                 description: Department ID
 *               hostel:
 *                 type: string
 *                 description: Hostel ID
 *               room:
 *                 type: string
 *                 description: Room ID
 *               emergencyContact:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   relationship:
 *                     type: string
 *                   phoneNumber:
 *                     type: string
 *     responses:
 *       200:
 *         description: Student updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Student updated successfully
 *                 student:
 *                   type: object
 *       404:
 *         description: Student not found
 *       409:
 *         description: Matric number or email already exists
 *       400:
 *         description: Invalid input data
 */
router.put('/students/:id', validateMongoId, adminController.updateStudent);

/**
 * @swagger
 * /api/admin/students/{id}:
 *   delete:
 *     summary: Delete a student (soft delete by default, permanent delete with query param)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ID
 *       - in: query
 *         name: permanent
 *         schema:
 *           type: boolean
 *         description: If true, permanently delete the student. Otherwise, soft delete (set isActive to false)
 *         example: false
 *     responses:
 *       200:
 *         description: Student deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Student soft deleted successfully
 *                 student:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     matricNo:
 *                       type: string
 *                     name:
 *                       type: string
 *       404:
 *         description: Student not found
 *       500:
 *         description: Server error
 */
router.delete('/students/:id', validateMongoId, adminController.deleteStudent);

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
 *               - level
 *               - gender
 *               - totalRooms
 *             properties:
 *               name:
 *                 type: string
 *                 example: Kings Hostel
 *                 description: Unique hostel name
 *               level:
 *                 type: number
 *                 enum: [100, 200, 300, 400, 500]
 *                 example: 100
 *                 description: Academic level for this hostel
 *               gender:
 *                 type: string
 *                 enum: [male, female, mixed]
 *                 example: male
 *                 description: Gender restriction for hostel
 *               totalRooms:
 *                 type: number
 *                 minimum: 1
 *                 example: 50
 *                 description: Total number of rooms in the hostel
 *               description:
 *                 type: string
 *                 example: Male hostel for first year students
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
 * /api/admin/hostels/{id}:
 *   put:
 *     summary: Update hostel details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Hostel ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Kings Hostel Updated
 *               level:
 *                 type: number
 *                 enum: [100, 200, 300, 400, 500]
 *                 example: 200
 *               gender:
 *                 type: string
 *                 enum: [male, female, mixed]
 *                 example: male
 *               totalRooms:
 *                 type: number
 *                 minimum: 1
 *                 example: 60
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Hostel updated successfully
 *       404:
 *         description: Hostel not found
 *       409:
 *         description: Hostel name already exists
 *   delete:
 *     summary: Delete a hostel (soft delete by default, permanent with query param)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Hostel ID
 *       - in: query
 *         name: permanent
 *         schema:
 *           type: boolean
 *         description: If true, permanently delete hostel and all rooms/bunks. Otherwise, soft delete (set isActive to false)
 *         example: false
 *     responses:
 *       200:
 *         description: Hostel deleted successfully
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
 *       404:
 *         description: Hostel not found
 *       400:
 *         description: Cannot delete hostel with rooms (use permanent=true to force)
 */
router.put('/hostels/:id', validateMongoId('id'), adminController.updateHostel);
router.delete('/hostels/:id', validateMongoId('id'), adminController.deleteHostel);

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
 * /api/admin/rooms/{id}:
 *   put:
 *     summary: Update a room
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roomNumber:
 *                 type: string
 *               hostel:
 *                 type: string
 *               capacity:
 *                 type: number
 *                 minimum: 2
 *               level:
 *                 type: number
 *                 enum: [100, 200, 300, 400, 500]
 *     responses:
 *       200:
 *         description: Room updated successfully
 *       404:
 *         description: Room not found
 */
router.put('/rooms/:id', validateMongoId('id'), validateRoom, adminController.updateRoom);

/**
 * @swagger
 * /api/admin/rooms/{id}:
 *   delete:
 *     summary: Delete a room (soft delete by default, use ?permanent=true for hard delete)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *       - in: query
 *         name: permanent
 *         schema:
 *           type: boolean
 *         description: Set to true for permanent deletion
 *     responses:
 *       200:
 *         description: Room deleted successfully
 *       400:
 *         description: Cannot delete room with occupants
 *       404:
 *         description: Room not found
 */
router.delete('/rooms/:id', validateMongoId('id'), adminController.deleteRoom);

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

// Payment Management
/**
 * @swagger
 * /api/admin/payment/set-amount:
 *   post:
 *     summary: Set hostel payment amount
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
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 50000
 *                 description: Hostel payment amount in Naira
 *               semester:
 *                 type: string
 *                 example: "First Semester"
 *               academicYear:
 *                 type: string
 *                 example: "2024/2025"
 *     responses:
 *       200:
 *         description: Payment amount set successfully
 *       400:
 *         description: Invalid amount
 */
router.post('/payment/set-amount', paymentController.setPaymentAmount);

/**
 * @swagger
 * /api/admin/payment/amount:
 *   get:
 *     summary: Get current hostel payment amount
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current payment amount
 *       404:
 *         description: Payment amount not set
 */
router.get('/payment/amount', paymentController.getPaymentAmount);

/**
 * @swagger
 * /api/admin/payment/stats:
 *   get:
 *     summary: Get payment statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment statistics
 */
router.get('/payment/stats', paymentController.getPaymentStats);

/**
 * @swagger
 * /api/admin/payments:
 *   get:
 *     summary: Get all payments
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed, cancelled]
 *       - in: query
 *         name: semester
 *         schema:
 *           type: string
 *       - in: query
 *         name: academicYear
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *     responses:
 *       200:
 *         description: List of all payments
 */
router.get('/payments', paymentController.getAllPayments);

module.exports = router;
