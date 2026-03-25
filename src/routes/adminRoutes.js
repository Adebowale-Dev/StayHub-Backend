const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminController = require('../controllers/adminController');
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middlewares/authMiddleware');
const { adminOnly } = require('../middlewares/roleMiddleware');
const { validateCollege, validateDepartment, validateStudent, validateHostel, validateRoom, validateMongoId, } = require('../middlewares/validationMiddleware');
const upload = multer({ dest: 'uploads/' });
router.use(protect, adminOnly);
router.get('/search', adminController.search);
router.get('/dashboard', adminController.getDashboardStats);
router.get('/notifications/history', adminController.getNotificationHistory);
router.post('/notifications/test', adminController.sendTestNotification);
router.post('/notifications/broadcast', adminController.sendBroadcastNotification);
router.get('/colleges/statistics', adminController.getCollegeStatistics);
router.post('/colleges', validateCollege, adminController.createCollege);
router.get('/colleges', adminController.getColleges);
router.put('/colleges/:id', validateMongoId('id'), validateCollege, adminController.updateCollege);
router.delete('/colleges/:id', validateMongoId('id'), adminController.deleteCollege);
router.post('/colleges/:collegeId/departments', validateMongoId('collegeId'), validateDepartment, adminController.createDepartment);
router.get('/colleges/:collegeId/departments', validateMongoId('collegeId'), adminController.getDepartments);
router.put('/colleges/:collegeId/departments/:deptId', validateMongoId('collegeId'), validateMongoId('deptId'), adminController.updateDepartment);
router.delete('/colleges/:collegeId/departments/:deptId', validateMongoId('collegeId'), validateMongoId('deptId'), adminController.deleteDepartment);
router.get('/colleges/:collegeId/students', validateMongoId('collegeId'), adminController.getStudentsByCollege);
router.get('/colleges/:collegeId/departments/:deptId/students', validateMongoId('collegeId'), validateMongoId('deptId'), adminController.getStudentsByDepartment);
router.post('/students', validateStudent, adminController.createStudent);
router.get('/students/import-template', adminController.downloadStudentImportTemplate);
router.post('/students/bulk-upload', upload.single('file'), adminController.bulkUploadStudents);
router.get('/students', adminController.getStudents);
router.get('/students/male', adminController.getMaleStudents);
router.get('/students/female', adminController.getFemaleStudents);
router.patch('/students/:id/password', adminController.resetStudentPassword);
router.put('/students/:id', validateMongoId('id'), adminController.updateStudent);
router.delete('/students/:id', validateMongoId('id'), adminController.deleteStudent);
router.post('/students/:id/force-delete', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🔴 Force delete START for student ID:', id);
        const mongoose = require('mongoose');
        const ObjectId = mongoose.Types.ObjectId;
        console.log('🟡 Deleting from MongoDB collection directly...');
        const result = await mongoose.connection.db
            .collection('students')
            .deleteOne({ _id: new ObjectId(id) });
        console.log('🟢 Delete completed successfully. Deleted count:', result.deletedCount);
        return res.status(200).json({
            success: true,
            message: 'Student deleted successfully',
            deletedCount: result.deletedCount
        });
    }
    catch (error) {
        console.error('❌ Force delete ERROR:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.post('/hostels', validateHostel, adminController.createHostel);
router.get('/hostels/import-template', adminController.downloadHostelImportTemplate);
router.post('/hostels/bulk-upload', upload.single('file'), adminController.bulkUploadHostels);
router.get('/hostels', adminController.getHostels);
router.put('/hostels/:id', validateMongoId('id'), adminController.updateHostel);
router.delete('/hostels/:id', validateMongoId('id'), adminController.deleteHostel);
router.post('/rooms', validateRoom, adminController.createRoom);
router.get('/rooms/import-template', adminController.downloadRoomImportTemplate);
router.post('/rooms/bulk-upload', upload.single('file'), adminController.bulkUploadRooms);
router.get('/rooms', adminController.getRooms);
router.put('/rooms/:id', validateMongoId('id'), validateRoom, adminController.updateRoom);
router.delete('/rooms/:id', validateMongoId('id'), adminController.deleteRoom);
router.post('/porters', adminController.createPorter);
router.put('/porters/:id', validateMongoId('id'), adminController.updatePorter);
router.delete('/porters/:id', validateMongoId('id'), adminController.deletePorter);
router.post('/porters/assign-hostel', adminController.assignHostelToPorter);
router.post('/porters/approve', adminController.approvePorter);
router.get('/porters', adminController.getPorters);
router.post('/payment/set-amount', paymentController.setPaymentAmount);
router.get('/payment/amount', paymentController.getPaymentAmount);
router.get('/payment/stats', paymentController.getPaymentStats);
router.get('/payments', paymentController.getAllPayments);
module.exports = router;
