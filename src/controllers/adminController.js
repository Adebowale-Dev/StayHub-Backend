const College = require('../models/College');
const Department = require('../models/Department');
const Student = require('../models/Student');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Bunk = require('../models/Bunk');
const Porter = require('../models/Porter');
const NotificationCampaign = require('../models/NotificationCampaign');
const { generateDefaultPassword } = require('../utils/passwordUtils');
const csv = require('csv-parser');
const fs = require('fs');
const notificationService = require('../services/notificationService');
const cacheService = require('../services/cacheService');
const { syncRoomBunksToCapacity } = require('../utils/roomBunkUtils');
const {
    buildStudentImportTemplateCsv,
    formatStudentImportError,
    parseStudentImportRow,
} = require('../utils/studentCsvUtils');
const {
    buildHostelImportTemplateCsv,
    buildRoomImportTemplateCsv,
    parseHostelImportRow,
    parseRoomImportRow,
    parseImportError,
} = require('../utils/housingCsvUtils');
const ADMIN_NOTIFICATION_LIMIT = 50;
const ADMIN_NOTIFICATION_SAMPLE_LIMIT = 12;
const ADMIN_NOTIFICATION_TYPES = new Set(['warning', 'info', 'error', 'success']);
const STUDENT_NOTIFICATION_DESTINATIONS = new Set([
    '/student/notifications',
    '/student/reservation',
    '/student/payment',
    '/student/profile',
    '/student/hostels',
]);
const getStudentFullName = (student) => [student?.firstName, student?.lastName].filter(Boolean).join(' ').trim() || student?.matricNo || 'Student';
const normalizeAdminNotificationType = (value) => ADMIN_NOTIFICATION_TYPES.has(String(value || '').toLowerCase())
    ? String(value).toLowerCase()
    : 'info';
const normalizeAdminNotificationDestination = (value) => STUDENT_NOTIFICATION_DESTINATIONS.has(value) ? value : '/student/notifications';
const buildAdminNotificationRecord = ({ campaignId, adminId, source, title, message, type, icon, destination, studentId, }) => ({
    notificationId: `admin:${campaignId}:${studentId}:${Date.now()}`,
    source,
    title,
    message,
    type,
    icon,
    category: 'announcement',
    destination,
    campaignId,
    createdBy: adminId,
    createdAt: new Date(),
});
const resolveAudienceConfig = async (payload = {}) => {
    const scope = String(payload.scope || 'all').toLowerCase();
    const query = { isActive: true };
    const target = {
        scope,
        label: 'All active students',
    };
    if (scope === 'student') {
        if (!payload.studentId) {
            throw new Error('Student selection is required for a test notification');
        }
        const student = await Student.findOne({ _id: payload.studentId, isActive: true }).select('firstName lastName matricNo email');
        if (!student) {
            throw new Error('Selected student could not be found');
        }
        return {
            query: { _id: student._id, isActive: true },
            target: {
                scope,
                student: student._id,
                label: `${getStudentFullName(student)} (${student.matricNo})`,
            },
        };
    }
    if (scope === 'hostel') {
        if (!payload.hostelId) {
            throw new Error('Hostel selection is required');
        }
        const hostel = await Hostel.findById(payload.hostelId).select('name');
        if (!hostel) {
            throw new Error('Selected hostel could not be found');
        }
        query.assignedHostel = hostel._id;
        target.hostel = hostel._id;
        target.label = `Students in ${hostel.name}`;
    }
    if (scope === 'college') {
        if (!payload.collegeId) {
            throw new Error('College selection is required');
        }
        const college = await College.findById(payload.collegeId).select('name code');
        if (!college) {
            throw new Error('Selected college could not be found');
        }
        query.college = college._id;
        target.college = college._id;
        target.label = `Students in ${college.name}`;
    }
    if (scope === 'department') {
        if (!payload.departmentId) {
            throw new Error('Department selection is required');
        }
        const department = await Department.findById(payload.departmentId).select('name code');
        if (!department) {
            throw new Error('Selected department could not be found');
        }
        query.department = department._id;
        target.department = department._id;
        target.label = `Students in ${department.name}`;
    }
    if (scope === 'level') {
        const level = parseInt(payload.level, 10);
        if (![100, 200, 300, 400, 500, 600].includes(level)) {
            throw new Error('A valid level is required');
        }
        query.level = level;
        target.level = level;
        target.label = `${level} level students`;
    }
    return { query, target };
};
const executeAdminNotificationCampaign = async ({ adminId, mode, title, message, type, icon, destination, forceEmail = false, audiencePayload, }) => {
    const { query, target } = await resolveAudienceConfig(audiencePayload);
    const students = await Student.find(query).select('firstName lastName matricNo email notificationPreferences pushDevices');
    if (students.length === 0) {
        throw new Error('No matching students found for this notification');
    }
    const campaign = await NotificationCampaign.create({
        createdBy: adminId,
        mode,
        title,
        message,
        type,
        icon,
        destination,
        forceEmail,
        target,
        status: 'completed',
        stats: {
            recipients: students.length,
            inboxSaved: 0,
            pushAttempted: 0,
            pushDelivered: 0,
            emailSent: 0,
        },
    });
    const sendResults = await Promise.allSettled(students.map(async (student) => {
        const inboxNotification = buildAdminNotificationRecord({
            campaignId: campaign._id,
            adminId,
            source: mode === 'test' ? 'admin_test' : 'admin_broadcast',
            title,
            message,
            type,
            icon,
            destination,
            studentId: student._id,
        });
        await Student.updateOne({ _id: student._id }, {
            $push: {
                customNotifications: {
                    $each: [inboxNotification],
                    $slice: -ADMIN_NOTIFICATION_LIMIT,
                },
            },
        });
        const delivery = await notificationService.sendStudentCustomNotification(student, {
            title,
            message,
            type,
            destination,
            source: mode === 'test' ? 'admin_test' : 'admin_broadcast',
            campaignId: campaign._id,
            forceEmail,
        });
        return {
            studentId: student._id,
            name: getStudentFullName(student),
            matricNo: student.matricNo,
            email: student.email,
            inboxSaved: true,
            pushAttempted: Boolean(delivery.pushAttempted),
            pushDelivered: Boolean(delivery.pushDelivered),
            emailSent: Boolean(delivery.emailSent),
        };
    }));
    const successfulResults = sendResults
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);
    const stats = {
        recipients: students.length,
        inboxSaved: successfulResults.filter((result) => result.inboxSaved).length,
        pushAttempted: successfulResults.filter((result) => result.pushAttempted).length,
        pushDelivered: successfulResults.filter((result) => result.pushDelivered).length,
        emailSent: successfulResults.filter((result) => result.emailSent).length,
    };
    campaign.stats = stats;
    campaign.recipientSample = successfulResults.slice(0, ADMIN_NOTIFICATION_SAMPLE_LIMIT).map((result) => ({
        student: result.studentId,
        name: result.name,
        matricNo: result.matricNo,
        email: result.email,
        inboxSaved: result.inboxSaved,
        pushAttempted: result.pushAttempted,
        pushDelivered: result.pushDelivered,
        emailSent: result.emailSent,
    }));
    campaign.status =
        successfulResults.length === students.length
            ? 'completed'
            : successfulResults.length === 0
                ? 'failed'
                : 'partial';
    await campaign.save();
    return {
        campaign,
        students,
        stats,
    };
};
exports.createCollege = async (req, res) => {
    try {
        const college = await College.create(req.body);
        res.status(201).json({ success: true, data: college });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.getColleges = async (req, res) => {
    try {
        const colleges = await College.find({ isActive: true }).populate('departments');
        res.status(200).json({ success: true, data: colleges });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateCollege = async (req, res) => {
    try {
        const college = await College.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(200).json({ success: true, data: college });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.deleteCollege = async (req, res) => {
    try {
        await College.findByIdAndUpdate(req.params.id, { isActive: false });
        res.status(200).json({ success: true, message: 'College deleted successfully' });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.createDepartment = async (req, res) => {
    try {
        const { collegeId } = req.params;
        const { name, code, description } = req.body;
        if (!name || !code) {
            return res.status(400).json({
                success: false,
                message: 'Department name and code are required'
            });
        }
        const college = await College.findById(collegeId);
        if (!college) {
            return res.status(404).json({ success: false, message: 'College not found' });
        }
        const existingDept = await Department.findOne({
            college: collegeId,
            $or: [
                { code: code.toUpperCase() },
                { name: name }
            ]
        });
        if (existingDept) {
            return res.status(409).json({
                success: false,
                message: 'Department with this name or code already exists in this college'
            });
        }
        const department = await Department.create({
            name,
            code: code.toUpperCase(),
            description: description || '',
            college: collegeId,
            isActive: true
        });
        res.status(201).json({
            success: true,
            message: 'Department added successfully',
            data: {
                department,
                college: {
                    id: college._id,
                    name: college.name,
                    code: college.code
                }
            }
        });
    }
    catch (error) {
        console.error('createDepartment error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.getDepartments = async (req, res) => {
    try {
        const { collegeId } = req.params;
        const college = await College.findById(collegeId);
        if (!college) {
            return res.status(404).json({ success: false, message: 'College not found' });
        }
        const departments = await Department.find({
            college: collegeId,
            isActive: true
        }).lean();
        const mongoose = require('mongoose');
        const collegeObjectId = mongoose.Types.ObjectId.isValid(collegeId)
            ? new mongoose.Types.ObjectId(collegeId)
            : collegeId;
        const studentCounts = await Student.aggregate([
            {
                $match: {
                    college: collegeObjectId,
                    isActive: true
                }
            },
            {
                $group: {
                    _id: '$department',
                    count: { $sum: 1 }
                }
            }
        ]);
        const deptCountMap = {};
        studentCounts.forEach(item => {
            if (item._id) {
                deptCountMap[item._id.toString()] = item.count;
            }
        });
        const departmentsWithCounts = departments.map(dept => ({
            ...dept,
            studentCount: deptCountMap[dept._id.toString()] || 0
        }));
        res.status(200).json({
            success: true,
            data: {
                college: {
                    id: college._id,
                    name: college.name,
                    code: college.code
                },
                departments: departmentsWithCounts,
                total: departmentsWithCounts.length
            }
        });
    }
    catch (error) {
        console.error('getDepartments error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateDepartment = async (req, res) => {
    try {
        const { collegeId, deptId } = req.params;
        const { name, code, description, isActive } = req.body;
        const college = await College.findById(collegeId);
        if (!college) {
            return res.status(404).json({ success: false, message: 'College not found' });
        }
        const department = await Department.findOne({
            _id: deptId,
            college: collegeId
        });
        if (!department) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }
        if (name || code) {
            const duplicate = await Department.findOne({
                _id: { $ne: deptId },
                college: collegeId,
                $or: [
                    ...(name ? [{ name }] : []),
                    ...(code ? [{ code: code.toUpperCase() }] : [])
                ]
            });
            if (duplicate) {
                return res.status(409).json({
                    success: false,
                    message: 'Another department with this name or code already exists in this college'
                });
            }
        }
        if (name !== undefined)
            department.name = name;
        if (code !== undefined)
            department.code = code.toUpperCase();
        if (description !== undefined)
            department.description = description;
        if (isActive !== undefined)
            department.isActive = isActive;
        await department.save();
        res.status(200).json({
            success: true,
            message: 'Department updated successfully',
            data: department
        });
    }
    catch (error) {
        console.error('updateDepartment error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.deleteDepartment = async (req, res) => {
    try {
        const { collegeId, deptId } = req.params;
        const { force = 'false' } = req.query;
        const college = await College.findById(collegeId);
        if (!college) {
            return res.status(404).json({ success: false, message: 'College not found' });
        }
        const department = await Department.findOne({
            _id: deptId,
            college: collegeId
        });
        if (!department) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }
        const studentCount = await Student.countDocuments({
            college: collegeId,
            department: deptId
        });
        if (studentCount > 0 && force !== 'true') {
            return res.status(400).json({
                success: false,
                message: `Cannot delete department with ${studentCount} students. Use ?force=true to force delete.`,
                studentCount
            });
        }
        if (force === 'true' && studentCount > 0) {
            await Student.deleteMany({
                college: collegeId,
                department: deptId
            });
        }
        const deletedDept = {
            id: department._id,
            name: department.name,
            code: department.code
        };
        await Department.findByIdAndDelete(deptId);
        res.status(200).json({
            success: true,
            message: force === 'true' && studentCount > 0
                ? `Department and ${studentCount} students deleted successfully`
                : 'Department deleted successfully',
            data: {
                deletedDepartment: deletedDept,
                deletedStudents: force === 'true' ? studentCount : 0
            }
        });
    }
    catch (error) {
        console.error('deleteDepartment error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.createStudent = async (req, res) => {
    try {
        const studentData = {
            ...req.body,
            password: req.body.password || generateDefaultPassword(req.body.firstName),
        };
        const student = await Student.create(studentData);
        res.status(201).json({ success: true, data: student });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.downloadStudentImportTemplate = async (req, res) => {
    try {
        const csvContent = buildStudentImportTemplateCsv();
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="student_import_template.csv"');
        res.status(200).send(csvContent);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate student import template',
        });
    }
};
exports.bulkUploadStudents = async (req, res) => {
    if (!req.file?.path) {
        return res.status(400).json({
            success: false,
            message: 'A CSV file is required',
        });
    }

    try {
        const rows = await new Promise((resolve, reject) => {
            const parsedRows = [];

            fs.createReadStream(req.file.path)
                .pipe(csv())
                .on('data', (row) => {
                parsedRows.push(row);
            })
                .on('end', () => resolve(parsedRows))
                .on('error', reject);
        });

        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'The uploaded CSV file is empty',
            });
        }

        const errors = [];
        let createdCount = 0;

        for (const [index, row] of rows.entries()) {
            const rowNumber = index + 2;

            try {
                const studentData = await parseStudentImportRow(row);
                try {
                    await Student.create(studentData);
                    createdCount += 1;
                }
                catch (error) {
                    errors.push({
                        row: rowNumber,
                        matricNo: studentData.matricNo,
                        error: formatStudentImportError(error),
                        rowData: row,
                    });
                }
            }
            catch (error) {
                errors.push({
                    row: rowNumber,
                    matricNo: String(row?.matricNo || '').trim() || `Row ${rowNumber}`,
                    error: formatStudentImportError(error),
                    rowData: row,
                });
            }
        }

        const failedCount = errors.length;
        const totalRows = rows.length;
        const message = failedCount === 0
            ? `${createdCount} students imported successfully`
            : `Imported ${createdCount} students with ${failedCount} row issue(s)`;

        res.status(failedCount === 0 ? 201 : 200).json({
            success: failedCount === 0,
            message,
            data: {
                totalRows,
                createdCount,
                failedCount,
                errors: errors.length > 0 ? errors : undefined,
            },
        });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
    finally {
        await fs.promises.unlink(req.file.path).catch(() => undefined);
    }
};
exports.getStudents = async (req, res) => {
    try {
        const { level, college, department, paymentStatus, page = 1, limit = 50 } = req.query;
        const query = { isActive: true };
        if (level)
            query.level = level;
        if (college)
            query.college = college;
        if (department)
            query.department = department;
        if (paymentStatus)
            query.paymentStatus = paymentStatus;
        const students = await Student.find(query)
            .populate('college', 'name code')
            .populate('department', 'name code')
            .populate('assignedHostel', 'name code')
            .populate('assignedRoom', 'roomNumber')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });
        const count = await Student.countDocuments(query);
        res.status(200).json({
            success: true,
            data: students,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            total: count,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getMaleStudents = async (req, res) => {
    try {
        const { level, college, department, paymentStatus, page = 1, limit = 50 } = req.query;
        const query = { isActive: true, gender: 'male' };
        if (level)
            query.level = level;
        if (college)
            query.college = college;
        if (department)
            query.department = department;
        if (paymentStatus)
            query.paymentStatus = paymentStatus;
        const students = await Student.find(query)
            .populate('college', 'name code')
            .populate('department', 'name code')
            .populate('assignedHostel', 'name code')
            .populate('assignedRoom', 'roomNumber')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });
        const count = await Student.countDocuments(query);
        res.status(200).json({
            success: true,
            gender: 'male',
            data: students,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            total: count,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getFemaleStudents = async (req, res) => {
    try {
        const { level, college, department, paymentStatus, page = 1, limit = 50 } = req.query;
        const query = { isActive: true, gender: 'female' };
        if (level)
            query.level = level;
        if (college)
            query.college = college;
        if (department)
            query.department = department;
        if (paymentStatus)
            query.paymentStatus = paymentStatus;
        const students = await Student.find(query)
            .populate('college', 'name code')
            .populate('department', 'name code')
            .populate('assignedHostel', 'name code')
            .populate('assignedRoom', 'roomNumber')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });
        const count = await Student.countDocuments(query);
        res.status(200).json({
            success: true,
            gender: 'female',
            data: students,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            total: count,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getStudentsByCollege = async (req, res) => {
    try {
        const { collegeId } = req.params;
        const { level, department, paymentStatus, page = 1, limit = 50 } = req.query;
        const college = await College.findById(collegeId);
        if (!college) {
            return res.status(404).json({ success: false, message: 'College not found' });
        }
        const query = { isActive: true, college: collegeId };
        if (level)
            query.level = level;
        if (department)
            query.department = department;
        if (paymentStatus)
            query.paymentStatus = paymentStatus;
        const students = await Student.find(query)
            .populate('college', 'name code')
            .populate('department', 'name code')
            .populate('assignedHostel', 'name code')
            .populate('assignedRoom', 'roomNumber')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });
        const count = await Student.countDocuments(query);
        res.status(200).json({
            success: true,
            data: {
                college: {
                    id: college._id,
                    name: college.name,
                    code: college.code
                },
                students,
                totalPages: Math.ceil(count / limit),
                currentPage: parseInt(page),
                total: count
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getStudentsByDepartment = async (req, res) => {
    try {
        const { collegeId, deptId } = req.params;
        const { level, paymentStatus, page = 1, limit = 50 } = req.query;
        const college = await College.findById(collegeId);
        if (!college) {
            return res.status(404).json({ success: false, message: 'College not found' });
        }
        const department = await Department.findOne({
            _id: deptId,
            college: collegeId
        });
        if (!department) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }
        const query = { isActive: true, college: collegeId, department: deptId };
        if (level)
            query.level = level;
        if (paymentStatus)
            query.paymentStatus = paymentStatus;
        const students = await Student.find(query)
            .populate('college', 'name code')
            .populate('department', 'name code')
            .populate('assignedHostel', 'name code')
            .populate('assignedRoom', 'roomNumber')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });
        const count = await Student.countDocuments(query);
        res.status(200).json({
            success: true,
            data: {
                college: {
                    id: college._id,
                    name: college.name,
                    code: college.code
                },
                department: {
                    id: department._id,
                    name: department.name,
                    code: department.code
                },
                students,
                totalPages: Math.ceil(count / limit),
                currentPage: parseInt(page),
                total: count
            }
        });
    }
    catch (error) {
        console.error('getStudentsByDepartment error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };
        delete updateData.password;
        delete updateData.role;
        delete updateData._id;
        if (updateData.gender) {
            updateData.gender = updateData.gender.toLowerCase();
            if (!['male', 'female'].includes(updateData.gender)) {
                return res.status(400).json({
                    success: false,
                    message: 'Gender must be either male or female'
                });
            }
        }
        const needsExistingStudent = updateData.gender || updateData.matricNo || updateData.email;
        let student = null;
        if (needsExistingStudent) {
            student = await Student.findById(id).select('gender matricNo email assignedHostel');
            if (!student) {
                return res.status(404).json({ success: false, message: 'Student not found' });
            }
        }
        if (updateData.gender && student && updateData.gender !== student.gender && student.assignedHostel) {
            const hostel = await Hostel.findById(student.assignedHostel).select('gender');
            if (hostel && hostel.gender !== 'mixed') {
                const isCompatible = ((updateData.gender === 'male' && hostel.gender === 'male') ||
                    (updateData.gender === 'female' && hostel.gender === 'female'));
                if (!isCompatible) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot change gender while assigned to a ${hostel.gender} hostel. Please unassign from hostel first.`
                    });
                }
            }
        }
        if (updateData.matricNo && student && updateData.matricNo !== student.matricNo) {
            const existingStudent = await Student.findOne({
                matricNo: updateData.matricNo,
                _id: { $ne: id }
            }).select('_id');
            if (existingStudent) {
                return res.status(409).json({
                    success: false,
                    message: 'A student with this matric number already exists'
                });
            }
        }
        if (updateData.email && student && updateData.email !== student.email) {
            const existingStudent = await Student.findOne({
                email: updateData.email,
                _id: { $ne: id }
            }).select('_id');
            if (existingStudent) {
                return res.status(409).json({
                    success: false,
                    message: 'A student with this email already exists'
                });
            }
        }
        const updateResult = await Student.updateOne({ _id: id }, { $set: updateData });
        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        const updatedStudent = await Student.findById(id)
            .populate('college', 'name code')
            .populate('department', 'name code')
            .populate('assignedHostel', 'name code')
            .populate('assignedRoom', 'roomNumber');
        res.status(200).json({
            success: true,
            message: 'Student updated successfully',
            data: updatedStudent
        });
    }
    catch (error) {
        console.error('updateStudent error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.deleteStudent = async (req, res) => {
    console.log('🗑️  DELETE STARTED for student:', req.params.id);
    const startTime = Date.now();
    try {
        const { id } = req.params;
        const { permanent = 'false' } = req.query;
        console.log('📋 Delete type:', permanent === 'true' ? 'PERMANENT' : 'SOFT DELETE');
        if (permanent === 'true') {
            console.log('🔥 Executing permanent delete via direct MongoDB...');
            const result = await Student.collection.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
            const elapsed = Date.now() - startTime;
            console.log(`✅ Permanent delete completed in ${elapsed}ms`);
            if (result.deletedCount === 0) {
                console.log('❌ Student not found');
                return res.status(404).json({ success: false, message: 'Student not found' });
            }
            res.status(200).json({
                success: true,
                message: 'Student permanently deleted',
                data: { id }
            });
        }
        else {
            console.log('🔄 Executing soft delete via direct MongoDB...');
            const result = await Student.collection.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { $set: { isActive: false } });
            const elapsed = Date.now() - startTime;
            console.log(`✅ Soft delete completed in ${elapsed}ms`);
            if (result.matchedCount === 0) {
                console.log('❌ Student not found');
                return res.status(404).json({ success: false, message: 'Student not found' });
            }
            res.status(200).json({
                success: true,
                message: 'Student deactivated successfully',
                data: { id }
            });
        }
    }
    catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`❌ deleteStudent error after ${elapsed}ms:`, error);
        res.status(400).json({ success: false, message: error.message });
    }
};
async function autoGenerateRooms(hostelId, totalRooms, bedsPerRoom, floorsCount, level) {
    const rooms = [];
    for (let i = 0; i < totalRooms; i++) {
        const roomNumber = (i + 1).toString().padStart(2, '0');
        const floor = Math.floor(i / 15) + 1;
        rooms.push({
            roomNumber: roomNumber,
            hostel: hostelId,
            capacity: bedsPerRoom,
            currentOccupants: 0,
            floor: floor,
            level: level,
            status: 'available',
            isActive: true,
            availableSpaces: bedsPerRoom
        });
    }
    await Room.insertMany(rooms);
    const createdRooms = await Room.find({ hostel: hostelId });
    const allBunks = [];
    for (const room of createdRooms) {
        const numberOfBunks = room.capacity;
        for (let i = 1; i <= numberOfBunks; i++) {
            allBunks.push({
                bunkNumber: `B${i}`,
                room: room._id,
            });
        }
    }
    if (allBunks.length > 0) {
        await Bunk.insertMany(allBunks);
    }
    console.log(`Successfully created ${totalRooms} rooms with sequential numbering (01-${totalRooms.toString().padStart(2, '0')}) and bunks for hostel ${hostelId}`);
}
exports.createHostel = async (req, res) => {
    try {
        console.log('Creating hostel with data:', req.body);
        const { name, level, gender, totalRooms, autoCreateRooms, bedsPerRoom, floorsCount } = req.body;
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Hostel name is required'
            });
        }
        if (!level) {
            return res.status(400).json({
                success: false,
                message: 'Level is required'
            });
        }
        if (![100, 200, 300, 400, 500, 600].includes(Number(level))) {
            return res.status(400).json({
                success: false,
                message: 'Level must be 100, 200, 300, 400, 500, or 600'
            });
        }
        if (!gender) {
            return res.status(400).json({
                success: false,
                message: 'Gender is required'
            });
        }
        if (!['male', 'female', 'mixed'].includes(gender.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'Gender must be male, female, or mixed'
            });
        }
        if (!totalRooms || Number(totalRooms) < 1) {
            return res.status(400).json({
                success: false,
                message: 'Total rooms must be at least 1'
            });
        }
        if (autoCreateRooms) {
            if (!bedsPerRoom || Number(bedsPerRoom) < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Beds per room must be at least 2'
                });
            }
            if (!floorsCount || Number(floorsCount) < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Number of floors must be at least 1'
                });
            }
        }
        const hostel = await Hostel.create(req.body);
        cacheService.del(cacheService.cacheKeys.hostelsByLevel(hostel.level));
        if (autoCreateRooms && totalRooms > 0 && bedsPerRoom > 0 && floorsCount > 0) {
            await autoGenerateRooms(hostel._id, Number(totalRooms), Number(bedsPerRoom), Number(floorsCount), Number(level));
        }
        res.status(201).json({
            success: true,
            message: `Hostel created successfully${autoCreateRooms ? ` with ${totalRooms} rooms` : ''}`,
            data: hostel
        });
    }
    catch (error) {
        console.error('Create hostel error:', error);
        res.status(400).json({
            success: false,
            message: error.message,
            error: error.errors ? Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message
            })) : undefined
        });
    }
};
exports.downloadHostelImportTemplate = async (req, res) => {
    try {
        const csvContent = buildHostelImportTemplateCsv();
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="hostel_import_template.csv"');
        res.status(200).send(csvContent);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate hostel import template',
        });
    }
};
exports.bulkUploadHostels = async (req, res) => {
    if (!req.file?.path) {
        return res.status(400).json({
            success: false,
            message: 'A CSV file is required',
        });
    }
    try {
        const rows = await new Promise((resolve, reject) => {
            const parsedRows = [];
            fs.createReadStream(req.file.path)
                .pipe(csv())
                .on('data', (row) => {
                parsedRows.push(row);
            })
                .on('end', () => resolve(parsedRows))
                .on('error', reject);
        });
        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'The uploaded CSV file is empty',
            });
        }
        const errors = [];
        let createdCount = 0;
        for (const [index, row] of rows.entries()) {
            const rowNumber = index + 2;
            try {
                const hostelData = await parseHostelImportRow(row);
                try {
                    const hostel = await Hostel.create(hostelData);
                    cacheService.del(cacheService.cacheKeys.hostelsByLevel(hostel.level));
                    if (hostelData.autoCreateRooms && hostelData.totalRooms > 0 && hostelData.bedsPerRoom > 0 && hostelData.floorsCount > 0) {
                        await autoGenerateRooms(hostel._id, Number(hostelData.totalRooms), Number(hostelData.bedsPerRoom), Number(hostelData.floorsCount), Number(hostelData.level));
                    }
                    createdCount += 1;
                }
                catch (error) {
                    errors.push({
                        row: rowNumber,
                        name: hostelData.name,
                        error: parseImportError(error, { name: 'Hostel name already exists' }),
                        rowData: row,
                    });
                }
            }
            catch (error) {
                errors.push({
                    row: rowNumber,
                    name: String(row?.name || '').trim() || `Row ${rowNumber}`,
                    error: parseImportError(error),
                    rowData: row,
                });
            }
        }
        const failedCount = errors.length;
        const totalRows = rows.length;
        const message = failedCount === 0
            ? `${createdCount} hostels imported successfully`
            : `Imported ${createdCount} hostels with ${failedCount} row issue(s)`;
        res.status(failedCount === 0 ? 201 : 200).json({
            success: failedCount === 0,
            message,
            data: {
                totalRows,
                createdCount,
                failedCount,
                errors: errors.length > 0 ? errors : undefined,
            },
        });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
    finally {
        await fs.promises.unlink(req.file.path).catch(() => undefined);
    }
};
exports.getHostels = async (req, res) => {
    try {
        const { status } = req.query;
        const query = {};
        if (status === 'active') {
            query.isActive = true;
        }
        else if (status === 'inactive') {
            query.isActive = false;
        }
        const hostels = await Hostel.find(query).populate('portersAssigned').lean();
        const hostelsWithStats = await Promise.all(hostels.map(async (hostel) => {
            const rooms = await Room.find({ hostel: hostel._id });
            const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
            const currentOccupants = await Student.countDocuments({
                assignedHostel: hostel._id,
                reservationStatus: { $in: ['confirmed', 'checked_in'] },
            });
            return {
                ...hostel,
                totalCapacity,
                currentOccupants,
                availableCapacity: Math.max(0, totalCapacity - currentOccupants),
            };
        }));
        res.status(200).json({ success: true, data: hostelsWithStats });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateHostel = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = { ...req.body };
        const hostel = await Hostel.findById(id);
        if (!hostel) {
            return res.status(404).json({
                success: false,
                message: 'Hostel not found'
            });
        }
        if (updateData.name && updateData.name !== hostel.name) {
            const existingHostel = await Hostel.findOne({
                name: updateData.name,
                _id: { $ne: id }
            });
            if (existingHostel) {
                return res.status(409).json({
                    success: false,
                    message: 'A hostel with this name already exists'
                });
            }
        }
        if (updateData.level && ![100, 200, 300, 400, 500, 600].includes(Number(updateData.level))) {
            return res.status(400).json({
                success: false,
                message: 'Level must be 100, 200, 300, 400, 500, or 600'
            });
        }
        if (updateData.gender && !['male', 'female', 'mixed'].includes(updateData.gender.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'Gender must be male, female, or mixed'
            });
        }
        if (updateData.totalRooms && Number(updateData.totalRooms) < 1) {
            return res.status(400).json({
                success: false,
                message: 'Total rooms must be at least 1'
            });
        }
        const updatedHostel = await Hostel.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).populate('portersAssigned');
        cacheService.del(cacheService.cacheKeys.hostelsByLevel(hostel.level));
        if (updateData.level && updateData.level !== hostel.level) {
            cacheService.del(cacheService.cacheKeys.hostelsByLevel(updateData.level));
        }
        res.status(200).json({
            success: true,
            message: 'Hostel updated successfully',
            data: updatedHostel
        });
    }
    catch (error) {
        console.error('Update hostel error:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};
exports.deleteHostel = async (req, res) => {
    try {
        const { id } = req.params;
        const { permanent = 'false' } = req.query;
        console.log('DELETE hostel request - ID:', id, 'Permanent:', permanent);
        const hostel = await Hostel.findById(id);
        if (!hostel) {
            console.log('Hostel not found');
            return res.status(404).json({
                success: false,
                message: 'Hostel not found'
            });
        }
        console.log('Hostel found:', hostel.name);
        if (permanent === 'true') {
            const rooms = await Room.find({ hostel: id });
            console.log('Deleting', rooms.length, 'rooms');
            for (const room of rooms) {
                await Bunk.deleteMany({ room: room._id });
            }
            await Room.deleteMany({ hostel: id });
            await Hostel.findByIdAndDelete(id);
            cacheService.del(cacheService.cacheKeys.hostelsByLevel(hostel.level));
            console.log('Hostel permanently deleted');
            return res.status(200).json({
                success: true,
                message: `Hostel and ${rooms.length} rooms deleted permanently`,
                data: {
                    id: hostel._id,
                    name: hostel.name,
                    deletedRooms: rooms.length
                }
            });
        }
        else {
            hostel.isActive = false;
            await hostel.save();
            cacheService.del(cacheService.cacheKeys.hostelsByLevel(hostel.level));
            console.log('Hostel soft deleted');
            return res.status(200).json({
                success: true,
                message: 'Hostel deactivated successfully',
                data: hostel
            });
        }
    }
    catch (error) {
        console.error('Delete hostel error:', error);
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};
exports.createRoom = async (req, res) => {
    try {
        const { roomNumber, floor, capacity, level, hostel } = req.body;
        if (floor !== undefined && floor < 0) {
            return res.status(400).json({
                success: false,
                message: 'Floor cannot be negative'
            });
        }
        const room = await Room.create({
            roomNumber,
            floor,
            capacity,
            level,
            hostel
        });
        await syncRoomBunksToCapacity(room);
        cacheService.del(cacheService.cacheKeys.roomsByHostel(room.hostel));
        res.status(201).json({ success: true, data: room });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.downloadRoomImportTemplate = async (req, res) => {
    try {
        const csvContent = buildRoomImportTemplateCsv();
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="room_import_template.csv"');
        res.status(200).send(csvContent);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate room import template',
        });
    }
};
exports.bulkUploadRooms = async (req, res) => {
    if (!req.file?.path) {
        return res.status(400).json({
            success: false,
            message: 'A CSV file is required',
        });
    }
    try {
        const rows = await new Promise((resolve, reject) => {
            const parsedRows = [];
            fs.createReadStream(req.file.path)
                .pipe(csv())
                .on('data', (row) => {
                parsedRows.push(row);
            })
                .on('end', () => resolve(parsedRows))
                .on('error', reject);
        });
        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'The uploaded CSV file is empty',
            });
        }
        const errors = [];
        let createdCount = 0;
        for (const [index, row] of rows.entries()) {
            const rowNumber = index + 2;
            try {
                const roomData = await parseRoomImportRow(row);
                try {
                    const room = await Room.create(roomData);
                    await syncRoomBunksToCapacity(room);
                    cacheService.del(cacheService.cacheKeys.roomsByHostel(room.hostel));
                    createdCount += 1;
                }
                catch (error) {
                    errors.push({
                        row: rowNumber,
                        roomNumber: roomData.roomNumber,
                        error: parseImportError(error, { roomNumber: 'Room number already exists in the selected hostel' }),
                        rowData: row,
                    });
                }
            }
            catch (error) {
                errors.push({
                    row: rowNumber,
                    roomNumber: String(row?.roomNumber || '').trim() || `Row ${rowNumber}`,
                    error: parseImportError(error),
                    rowData: row,
                });
            }
        }
        const failedCount = errors.length;
        const totalRows = rows.length;
        const message = failedCount === 0
            ? `${createdCount} rooms imported successfully`
            : `Imported ${createdCount} rooms with ${failedCount} row issue(s)`;
        res.status(failedCount === 0 ? 201 : 200).json({
            success: failedCount === 0,
            message,
            data: {
                totalRows,
                createdCount,
                failedCount,
                errors: errors.length > 0 ? errors : undefined,
            },
        });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
    finally {
        await fs.promises.unlink(req.file.path).catch(() => undefined);
    }
};
exports.getRooms = async (req, res) => {
    try {
        const { hostel, status, isActive } = req.query;
        const query = {};
        if (hostel)
            query.hostel = hostel;
        if (status)
            query.status = status;
        if (isActive === 'true')
            query.isActive = true;
        if (isActive === 'false')
            query.isActive = false;
        const rooms = await Room.find(query).populate('hostel');
        res.status(200).json({ success: true, data: rooms });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateRoom = async (req, res) => {
    try {
        console.log('Updating room with ID:', req.params.id);
        console.log('Update data:', req.body);
        const { roomNumber, hostel, capacity, level, floor } = req.body;
        if (floor !== undefined && floor < 0) {
            return res.status(400).json({
                success: false,
                message: 'Floor cannot be negative'
            });
        }
        const existingRoom = await Room.findById(req.params.id);
        if (!existingRoom) {
            console.log('Room not found:', req.params.id);
            return res.status(404).json({ success: false, message: 'Room not found' });
        }
        if (hostel && hostel !== existingRoom.hostel.toString()) {
            const hostelExists = await Hostel.findById(hostel);
            if (!hostelExists) {
                return res.status(404).json({ success: false, message: 'Hostel not found' });
            }
        }
        const oldCapacity = existingRoom.capacity;
        const newCapacity = capacity || oldCapacity;
        if (Number(newCapacity) < Number(existingRoom.currentOccupants || 0)) {
            return res.status(400).json({
                success: false,
                message: `Capacity cannot be lower than the current occupant count (${existingRoom.currentOccupants})`
            });
        }
        const updatedRoom = await Room.findByIdAndUpdate(req.params.id, { roomNumber, hostel, capacity: newCapacity, level, floor }, { new: true, runValidators: true }).populate('hostel');
        if (Number(oldCapacity) !== Number(newCapacity)) {
            await syncRoomBunksToCapacity(updatedRoom);
        }
        cacheService.del(cacheService.cacheKeys.roomsByHostel(updatedRoom.hostel._id));
        console.log('Room updated successfully:', updatedRoom);
        res.status(200).json({ success: true, data: updatedRoom });
    }
    catch (error) {
        console.error('Update room error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.deleteRoom = async (req, res) => {
    try {
        console.log('Deleting room with ID:', req.params.id);
        const room = await Room.findById(req.params.id);
        if (!room) {
            console.log('Room not found:', req.params.id);
            return res.status(404).json({ success: false, message: 'Room not found' });
        }
        if (room.currentOccupants > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete room with current occupants. Please reassign students first.'
            });
        }
        await Bunk.deleteMany({ room: room._id });
        await Room.findByIdAndDelete(req.params.id);
        console.log('Room permanently deleted:', req.params.id);
        cacheService.del(cacheService.cacheKeys.roomsByHostel(room.hostel));
        res.status(200).json({
            success: true,
            message: 'Room permanently deleted'
        });
    }
    catch (error) {
        console.error('Delete room error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.createPorter = async (req, res) => {
    try {
        const { firstName, lastName, email, password, phoneNumber, assignedHostel, employeeId, shiftSchedule } = req.body;
        console.log('Creating porter:', { firstName, lastName, email });
        const existingPorter = await Porter.findOne({ email: email.toLowerCase() });
        if (existingPorter) {
            return res.status(400).json({
                success: false,
                message: 'Porter with this email already exists',
            });
        }
        if (employeeId) {
            const existingEmployeeId = await Porter.findOne({ employeeId });
            if (existingEmployeeId) {
                return res.status(400).json({
                    success: false,
                    message: 'Employee ID already exists',
                });
            }
        }
        if (assignedHostel) {
            const hostel = await Hostel.findById(assignedHostel);
            if (!hostel) {
                return res.status(404).json({
                    success: false,
                    message: 'Assigned hostel not found',
                });
            }
        }
        const porter = await Porter.create({
            firstName,
            lastName,
            email: email.toLowerCase(),
            password: password || 'Porter123',
            phoneNumber,
            assignedHostel,
            employeeId,
            joinedDate: new Date(),
            shiftSchedule,
            status: 'active',
            approved: true,
            approvedDate: new Date(),
            approvedBy: req.user._id,
            firstLogin: true,
        });
        if (assignedHostel) {
            await Hostel.findByIdAndUpdate(assignedHostel, {
                $push: { portersAssigned: porter._id }
            });
        }
        console.log('Porter created successfully:', porter._id);
        res.status(201).json({
            success: true,
            message: 'Porter created successfully',
            data: porter,
        });
    }
    catch (error) {
        console.error('Create porter error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create porter',
        });
    }
};
exports.approvePorter = async (req, res) => {
    try {
        const { porterId, hostelId } = req.body;
        const porter = await Porter.findById(porterId);
        porter.approved = true;
        porter.status = 'approved';
        porter.assignedHostel = hostelId;
        porter.approvedDate = new Date();
        porter.approvedBy = req.user._id;
        await porter.save();
        await Hostel.findByIdAndUpdate(hostelId, { $push: { portersAssigned: porterId } });
        await notificationService.notifyPorterApproved(porterId);
        res.status(200).json({ success: true, data: porter });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.updatePorter = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, email, phoneNumber, assignedHostel, employeeId, shiftSchedule, status } = req.body;
        console.log('Updating porter:', id, req.body);
        const porter = await Porter.findById(id);
        if (!porter) {
            return res.status(404).json({
                success: false,
                message: 'Porter not found',
            });
        }
        const oldHostel = porter.assignedHostel;
        if (email && email !== porter.email) {
            const existingPorter = await Porter.findOne({
                email: email.toLowerCase(),
                _id: { $ne: id }
            });
            if (existingPorter) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already in use by another porter',
                });
            }
            porter.email = email.toLowerCase();
        }
        if (employeeId && employeeId !== porter.employeeId) {
            const existingEmployeeId = await Porter.findOne({
                employeeId,
                _id: { $ne: id }
            });
            if (existingEmployeeId) {
                return res.status(400).json({
                    success: false,
                    message: 'Employee ID already in use',
                });
            }
            porter.employeeId = employeeId;
        }
        if (assignedHostel && assignedHostel !== oldHostel?.toString()) {
            const hostel = await Hostel.findById(assignedHostel);
            if (!hostel) {
                return res.status(404).json({
                    success: false,
                    message: 'Assigned hostel not found',
                });
            }
            if (oldHostel) {
                await Hostel.findByIdAndUpdate(oldHostel, {
                    $pull: { portersAssigned: porter._id }
                });
            }
            await Hostel.findByIdAndUpdate(assignedHostel, {
                $addToSet: { portersAssigned: porter._id }
            });
            porter.assignedHostel = assignedHostel;
        }
        if (firstName)
            porter.firstName = firstName;
        if (lastName)
            porter.lastName = lastName;
        if (phoneNumber)
            porter.phoneNumber = phoneNumber;
        if (shiftSchedule !== undefined)
            porter.shiftSchedule = shiftSchedule;
        if (status)
            porter.status = status;
        await porter.save();
        await porter.populate('assignedHostel', 'name code location gender');
        console.log('Porter updated successfully:', porter._id);
        res.status(200).json({
            success: true,
            message: 'Porter updated successfully',
            data: porter,
        });
    }
    catch (error) {
        console.error('Update porter error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update porter',
        });
    }
};
exports.deletePorter = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Deleting porter:', id);
        const porter = await Porter.findById(id);
        if (!porter) {
            return res.status(404).json({
                success: false,
                message: 'Porter not found',
            });
        }
        if (porter.assignedHostel) {
            await Hostel.findByIdAndUpdate(porter.assignedHostel, {
                $pull: { portersAssigned: porter._id }
            });
        }
        await Porter.findByIdAndDelete(id);
        console.log('Porter deleted successfully:', id);
        res.status(200).json({
            success: true,
            message: 'Porter deleted successfully',
        });
    }
    catch (error) {
        console.error('Delete porter error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete porter',
        });
    }
};
exports.assignHostelToPorter = async (req, res) => {
    try {
        const { porterId, hostelId } = req.body;
        console.log('Assigning hostel to porter:', { porterId, hostelId });
        if (!porterId || !hostelId) {
            return res.status(400).json({
                success: false,
                message: 'Porter ID and Hostel ID are required',
            });
        }
        const porter = await Porter.findById(porterId);
        if (!porter) {
            return res.status(404).json({
                success: false,
                message: 'Porter not found',
            });
        }
        const hostel = await Hostel.findById(hostelId);
        if (!hostel) {
            return res.status(404).json({
                success: false,
                message: 'Hostel not found',
            });
        }
        const oldHostel = porter.assignedHostel;
        if (oldHostel && oldHostel.toString() !== hostelId) {
            await Hostel.findByIdAndUpdate(oldHostel, {
                $pull: { portersAssigned: porter._id }
            });
        }
        await Hostel.findByIdAndUpdate(hostelId, {
            $addToSet: { portersAssigned: porter._id }
        });
        porter.assignedHostel = hostelId;
        await porter.save();
        await porter.populate('assignedHostel', 'name code location gender');
        console.log('Hostel assigned successfully to porter:', porter._id);
        res.status(200).json({
            success: true,
            message: `Hostel "${hostel.name}" assigned successfully to ${porter.firstName} ${porter.lastName}`,
            data: porter,
        });
    }
    catch (error) {
        console.error('Error assigning hostel:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign hostel',
            error: error.message,
        });
    }
};
exports.getPorters = async (req, res) => {
    try {
        const porters = await Porter.find()
            .populate('assignedHostel', 'name code location gender')
            .sort({ createdAt: -1 })
            .lean();
        const transformedPorters = porters.map(porter => ({
            _id: porter._id,
            name: `${porter.firstName} ${porter.lastName}`,
            email: porter.email,
            phoneNumber: porter.phoneNumber,
            assignedHostel: porter.assignedHostel,
            employeeId: porter.employeeId,
            joinedDate: porter.joinedDate,
            status: porter.status,
            shiftSchedule: porter.shiftSchedule,
            approved: porter.approved,
            approvedDate: porter.approvedDate,
            firstLogin: porter.firstLogin,
            isActive: porter.isActive,
            createdAt: porter.createdAt,
        }));
        res.status(200).json({ success: true, data: transformedPorters });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.sendTestNotification = async (req, res) => {
    try {
        const title = String(req.body.title || '').trim();
        const message = String(req.body.message || '').trim();
        if (!title || !message) {
            return res.status(400).json({
                success: false,
                message: 'Title and message are required',
            });
        }
        const result = await executeAdminNotificationCampaign({
            adminId: req.user._id,
            mode: 'test',
            title,
            message,
            type: normalizeAdminNotificationType(req.body.type),
            icon: req.body.icon || 'bell-ring-outline',
            destination: normalizeAdminNotificationDestination(req.body.destination),
            forceEmail: Boolean(req.body.forceEmail),
            audiencePayload: {
                scope: 'student',
                studentId: req.body.studentId,
            },
        });
        res.status(200).json({
            success: true,
            message: 'Test notification sent successfully',
            data: {
                campaignId: result.campaign._id,
                stats: result.stats,
                target: result.campaign.target,
            },
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to send test notification',
        });
    }
};
exports.sendBroadcastNotification = async (req, res) => {
    try {
        const title = String(req.body.title || '').trim();
        const message = String(req.body.message || '').trim();
        if (!title || !message) {
            return res.status(400).json({
                success: false,
                message: 'Title and message are required',
            });
        }
        const result = await executeAdminNotificationCampaign({
            adminId: req.user._id,
            mode: 'broadcast',
            title,
            message,
            type: normalizeAdminNotificationType(req.body.type),
            icon: req.body.icon || 'bullhorn',
            destination: normalizeAdminNotificationDestination(req.body.destination),
            forceEmail: Boolean(req.body.forceEmail),
            audiencePayload: {
                scope: req.body.scope || 'all',
                hostelId: req.body.hostelId,
                collegeId: req.body.collegeId,
                departmentId: req.body.departmentId,
                level: req.body.level,
            },
        });
        res.status(200).json({
            success: true,
            message: 'Broadcast notification sent successfully',
            data: {
                campaignId: result.campaign._id,
                stats: result.stats,
                target: result.campaign.target,
            },
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to send broadcast notification',
        });
    }
};
exports.getNotificationHistory = async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
        const mode = req.query.mode ? String(req.query.mode).toLowerCase() : null;
        const query = mode && ['test', 'broadcast'].includes(mode) ? { mode } : {};
        const campaigns = await NotificationCampaign.find(query)
            .populate('createdBy', 'firstName lastName email')
            .populate('target.student', 'firstName lastName matricNo email')
            .populate('target.hostel', 'name code')
            .populate('target.college', 'name code')
            .populate('target.department', 'name code')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        const history = campaigns.map((campaign) => ({
            _id: campaign._id,
            mode: campaign.mode,
            title: campaign.title,
            message: campaign.message,
            type: campaign.type,
            icon: campaign.icon,
            destination: campaign.destination,
            forceEmail: campaign.forceEmail,
            status: campaign.status,
            stats: campaign.stats,
            target: {
                scope: campaign.target?.scope || 'all',
                label: campaign.target?.label ||
                    (campaign.target?.student
                        ? `${getStudentFullName(campaign.target.student)} (${campaign.target.student.matricNo})`
                        : campaign.target?.hostel?.name ||
                            campaign.target?.college?.name ||
                            campaign.target?.department?.name ||
                            (campaign.target?.level ? `${campaign.target.level} level students` : 'All active students')),
                student: campaign.target?.student
                    ? {
                        _id: campaign.target.student._id,
                        name: getStudentFullName(campaign.target.student),
                        matricNo: campaign.target.student.matricNo,
                        email: campaign.target.student.email,
                    }
                    : null,
                hostel: campaign.target?.hostel
                    ? {
                        _id: campaign.target.hostel._id,
                        name: campaign.target.hostel.name,
                        code: campaign.target.hostel.code,
                    }
                    : null,
                college: campaign.target?.college
                    ? {
                        _id: campaign.target.college._id,
                        name: campaign.target.college.name,
                        code: campaign.target.college.code,
                    }
                    : null,
                department: campaign.target?.department
                    ? {
                        _id: campaign.target.department._id,
                        name: campaign.target.department.name,
                        code: campaign.target.department.code,
                    }
                    : null,
                level: campaign.target?.level || null,
            },
            createdBy: campaign.createdBy
                ? {
                    _id: campaign.createdBy._id,
                    name: getStudentFullName(campaign.createdBy),
                    email: campaign.createdBy.email,
                }
                : null,
            recipientSample: campaign.recipientSample || [],
            createdAt: campaign.createdAt,
            updatedAt: campaign.updatedAt,
        }));
        res.status(200).json({
            success: true,
            data: history,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to load notification history',
        });
    }
};
exports.getDashboardStats = async (req, res) => {
    try {
        const totalStudents = await Student.countDocuments({ isActive: true });
        const studentsPaid = await Student.countDocuments({ paymentStatus: 'paid' });
        const totalHostels = await Hostel.countDocuments({ isActive: true });
        const totalRooms = await Room.countDocuments({ isActive: true });
        const occupiedRooms = await Room.countDocuments({ status: { $in: ['partially_occupied', 'full'] } });
        const totalPorters = await Porter.countDocuments({ approved: true });
        res.status(200).json({
            success: true,
            data: {
                totalStudents,
                studentsPaid,
                studentsPending: totalStudents - studentsPaid,
                totalHostels,
                totalRooms,
                occupiedRooms,
                availableRooms: totalRooms - occupiedRooms,
                totalPorters,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCollegeStatistics = async (req, res) => {
    try {
        const colleges = await College.find({ isActive: true }).lean();
        const studentCounts = await Student.aggregate([
            {
                $match: { isActive: true }
            },
            {
                $group: {
                    _id: '$college',
                    count: { $sum: 1 }
                }
            }
        ]);
        const departmentCounts = await Department.aggregate([
            {
                $match: { isActive: true }
            },
            {
                $group: {
                    _id: '$college',
                    count: { $sum: 1 }
                }
            }
        ]);
        const totalStudents = await Student.countDocuments({ isActive: true });
        const totalDepartments = await Department.countDocuments({ isActive: true });
        const collegeStudentMap = {};
        studentCounts.forEach((item) => {
            collegeStudentMap[item._id?.toString()] = item.count;
        });
        const collegeDeptMap = {};
        departmentCounts.forEach((item) => {
            collegeDeptMap[item._id?.toString()] = item.count;
        });
        const collegesBreakdown = [];
        for (const college of colleges) {
            const studentCount = collegeStudentMap[college._id.toString()] || 0;
            const deptCount = collegeDeptMap[college._id.toString()] || 0;
            collegesBreakdown.push({
                id: college._id,
                name: college.name,
                code: college.code,
                departmentCount: deptCount,
                studentCount: studentCount,
                isActive: college.isActive,
            });
        }
        const statistics = {
            totalColleges: colleges.length,
            activeColleges: colleges.filter((c) => c.isActive).length,
            inactiveColleges: colleges.filter((c) => !c.isActive).length,
            totalDepartments: totalDepartments,
            totalStudents: totalStudents,
            collegesBreakdown: collegesBreakdown,
        };
        res.status(200).json({
            success: true,
            data: statistics,
        });
    }
    catch (error) {
        console.error('getCollegeStatistics error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.search = async (req, res) => {
    try {
        const { query, type, college, level, department, status, page = 1, limit = 20 } = req.query;
        if (!query || query.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }
        const searchQuery = query.trim();
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const results = {
            students: [],
            colleges: [],
            departments: [],
            hostels: [],
            rooms: [],
            porters: []
        };
        const mongoose = require('mongoose');
        const isValidObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id);
        if (!type || type === 'students' || type === 'all') {
            const studentFilter = {
                isActive: true,
                $or: [
                    { matricNo: { $regex: searchQuery, $options: 'i' } },
                    { firstName: { $regex: searchQuery, $options: 'i' } },
                    { lastName: { $regex: searchQuery, $options: 'i' } },
                    { email: { $regex: searchQuery, $options: 'i' } },
                    { phoneNumber: { $regex: searchQuery, $options: 'i' } }
                ]
            };
            if (college && isValidObjectId(college))
                studentFilter.college = college;
            if (level)
                studentFilter.level = parseInt(level);
            if (department && isValidObjectId(department))
                studentFilter.department = department;
            if (status) {
                if (status === 'paid')
                    studentFilter.paymentStatus = 'paid';
                if (status === 'unpaid')
                    studentFilter.paymentStatus = { $in: ['pending', 'failed'] };
                if (status === 'reserved')
                    studentFilter.reservationStatus = { $in: ['temporary', 'confirmed'] };
                if (status === 'checked_in')
                    studentFilter.reservationStatus = 'checked_in';
            }
            const students = await Student.find(studentFilter)
                .populate('college', 'name code')
                .populate('department', 'name code')
                .populate('assignedHostel', 'name code')
                .populate('assignedRoom', 'roomNumber')
                .populate('assignedBunk', 'bunkNumber')
                .limit(parseInt(limit))
                .skip(skip)
                .sort({ createdAt: -1 });
            results.students = students;
            results.studentsCount = await Student.countDocuments(studentFilter);
        }
        if (!type || type === 'colleges' || type === 'all') {
            const collegeFilter = {
                isActive: true,
                $or: [
                    { name: { $regex: searchQuery, $options: 'i' } },
                    { code: { $regex: searchQuery, $options: 'i' } }
                ]
            };
            const colleges = await College.find(collegeFilter)
                .populate('departments')
                .limit(parseInt(limit))
                .skip(skip);
            results.colleges = colleges;
            results.collegesCount = await College.countDocuments(collegeFilter);
        }
        if (!type || type === 'departments' || type === 'all') {
            const departmentFilter = {
                isActive: true,
                $or: [
                    { name: { $regex: searchQuery, $options: 'i' } },
                    { code: { $regex: searchQuery, $options: 'i' } }
                ]
            };
            if (college && isValidObjectId(college))
                departmentFilter.college = college;
            const departments = await Department.find(departmentFilter)
                .populate('college', 'name code')
                .limit(parseInt(limit))
                .skip(skip);
            results.departments = departments;
            results.departmentsCount = await Department.countDocuments(departmentFilter);
        }
        if (!type || type === 'hostels' || type === 'all') {
            const hostelFilter = {
                isActive: true,
                $or: [
                    { name: { $regex: searchQuery, $options: 'i' } },
                    { code: { $regex: searchQuery, $options: 'i' } },
                    { location: { $regex: searchQuery, $options: 'i' } }
                ]
            };
            if (level) {
                hostelFilter.allowedLevels = parseInt(level);
            }
            const hostels = await Hostel.find(hostelFilter)
                .populate('porter', 'firstName lastName email phoneNumber')
                .limit(parseInt(limit))
                .skip(skip);
            results.hostels = hostels;
            results.hostelsCount = await Hostel.countDocuments(hostelFilter);
        }
        if (!type || type === 'rooms' || type === 'all') {
            const roomFilter = {
                isActive: true,
                $or: [
                    { roomNumber: { $regex: searchQuery, $options: 'i' } }
                ]
            };
            if (status) {
                roomFilter.status = status;
            }
            const rooms = await Room.find(roomFilter)
                .populate('hostel', 'name code location')
                .populate('bunks')
                .limit(parseInt(limit))
                .skip(skip);
            results.rooms = rooms;
            results.roomsCount = await Room.countDocuments(roomFilter);
        }
        if (!type || type === 'porters' || type === 'all') {
            const porterFilter = {
                $or: [
                    { firstName: { $regex: searchQuery, $options: 'i' } },
                    { lastName: { $regex: searchQuery, $options: 'i' } },
                    { email: { $regex: searchQuery, $options: 'i' } },
                    { phoneNumber: { $regex: searchQuery, $options: 'i' } }
                ]
            };
            if (status) {
                if (status === 'approved')
                    porterFilter.approved = true;
                if (status === 'pending')
                    porterFilter.approved = false;
            }
            const porters = await Porter.find(porterFilter)
                .populate('hostel', 'name code location')
                .limit(parseInt(limit))
                .skip(skip)
                .sort({ createdAt: -1 });
            results.porters = porters;
            results.portersCount = await Porter.countDocuments(porterFilter);
        }
        const totalResults = (results.studentsCount || 0) +
            (results.collegesCount || 0) +
            (results.departmentsCount || 0) +
            (results.hostelsCount || 0) +
            (results.roomsCount || 0) +
            (results.portersCount || 0);
        res.status(200).json({
            success: true,
            query: searchQuery,
            type: type || 'all',
            filters: { college, level, department, status },
            totalResults,
            page: parseInt(page),
            limit: parseInt(limit),
            results
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.resetStudentPassword = async (req, res) => {
    console.log('🔑 PASSWORD RESET STARTED for student:', req.params.id);
    try {
        const { id } = req.params;
        const { newPassword, password } = req.body;
        const providedPassword = newPassword || password;
        console.log('🔍 Finding student...');
        const student = await Student.findById(id);
        if (!student) {
            console.log('❌ Student not found');
            return res.status(404).json({
                success: false,
                message: 'Student not found',
            });
        }
        console.log('✅ Student found:', student.matricNo);
        const resolvedPassword = providedPassword || generateDefaultPassword(student.firstName);
        console.log('📝 New password set (length):', resolvedPassword.length);
        console.log('🔐 Starting password hash...');
        const startTime = Date.now();
        student.password = resolvedPassword;
        student.firstLogin = true;
        await student.save();
        const endTime = Date.now();
        console.log(`✅ Password hashed and saved in ${endTime - startTime}ms`);
        res.status(200).json({
            success: true,
            message: 'Password reset successfully',
            defaultPassword: providedPassword ? undefined : resolvedPassword,
        });
    }
    catch (error) {
        console.error('❌ Reset password error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to reset password',
        });
    }
};
