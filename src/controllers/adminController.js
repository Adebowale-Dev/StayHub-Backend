const College = require('../models/College');
const Department = require('../models/Department');
const Student = require('../models/Student');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Bunk = require('../models/Bunk');
const Porter = require('../models/Porter');
const { generateDefaultPassword } = require('../utils/passwordUtils');
const csv = require('csv-parser');
const fs = require('fs');
const notificationService = require('../services/notificationService');
const cacheService = require('../services/cacheService');

// College Management
exports.createCollege = async (req, res) => {
  try {
    const college = await College.create(req.body);
    res.status(201).json({ success: true, data: college });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getColleges = async (req, res) => {
  try {
    const colleges = await College.find({ isActive: true }).populate('departments');
    res.status(200).json({ success: true, data: colleges });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCollege = async (req, res) => {
  try {
    const college = await College.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json({ success: true, data: college });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteCollege = async (req, res) => {
  try {
    await College.findByIdAndUpdate(req.params.id, { isActive: false });
    res.status(200).json({ success: true, message: 'College deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Department Management
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

    // Check for duplicate department code in this college
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

    // Create department
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
  } catch (error) {
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

    // Find all departments for this college
    const departments = await Department.find({ 
      college: collegeId,
      isActive: true 
    }).lean();

    // Convert ObjectId to mongoose ObjectId for aggregation
    const mongoose = require('mongoose');
    const collegeObjectId = mongoose.Types.ObjectId.isValid(collegeId) 
      ? new mongoose.Types.ObjectId(collegeId) 
      : collegeId;

    // Get student counts for all departments in one query
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

    // Create department count map
    const deptCountMap = {};
    studentCounts.forEach(item => {
      if (item._id) {
        deptCountMap[item._id.toString()] = item.count;
      }
    });

    // Assign student counts to departments
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
  } catch (error) {
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

    // Check for duplicate name/code if changing
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

    // Update fields
    if (name !== undefined) department.name = name;
    if (code !== undefined) department.code = code.toUpperCase();
    if (description !== undefined) department.description = description;
    if (isActive !== undefined) department.isActive = isActive;

    await department.save();

    res.status(200).json({ 
      success: true, 
      message: 'Department updated successfully',
      data: department 
    });
  } catch (error) {
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

    // Check if department has students
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

    // If force delete, remove all students in this department
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
  } catch (error) {
    console.error('deleteDepartment error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Student Management
exports.createStudent = async (req, res) => {
  try {
    const studentData = { ...req.body, password: generateDefaultPassword(req.body.firstName) };
    const student = await Student.create(studentData);
    res.status(201).json({ success: true, data: student });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.bulkUploadStudents = async (req, res) => {
  try {
    const students = [];
    const errors = [];
    
    // Parse CSV file
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (row) => {
        students.push({
          firstName: row.firstName,
          lastName: row.lastName,
          matricNo: row.matricNo,
          email: row.email,
          level: parseInt(row.level),
          gender: row.gender ? row.gender.toLowerCase() : 'male',
          college: row.college,
          department: row.department,
          password: generateDefaultPassword(row.firstName),
        });
      })
      .on('end', async () => {
        for (const studentData of students) {
          try {
            await Student.create(studentData);
          } catch (error) {
            errors.push({ student: studentData.matricNo, error: error.message });
          }
        }
        
        fs.unlinkSync(req.file.path);
        res.status(201).json({
          success: true,
          message: `${students.length - errors.length} students uploaded successfully`,
          errors: errors.length > 0 ? errors : undefined,
        });
      });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getStudents = async (req, res) => {
  try {
    const { level, college, department, paymentStatus, page = 1, limit = 50 } = req.query;
    const query = { isActive: true };
    
    if (level) query.level = level;
    if (college) query.college = college;
    if (department) query.department = department;
    if (paymentStatus) query.paymentStatus = paymentStatus;

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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMaleStudents = async (req, res) => {
  try {
    const { level, college, department, paymentStatus, page = 1, limit = 50 } = req.query;
    const query = { isActive: true, gender: 'male' };
    
    if (level) query.level = level;
    if (college) query.college = college;
    if (department) query.department = department;
    if (paymentStatus) query.paymentStatus = paymentStatus;

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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFemaleStudents = async (req, res) => {
  try {
    const { level, college, department, paymentStatus, page = 1, limit = 50 } = req.query;
    const query = { isActive: true, gender: 'female' };
    
    if (level) query.level = level;
    if (college) query.college = college;
    if (department) query.department = department;
    if (paymentStatus) query.paymentStatus = paymentStatus;

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
  } catch (error) {
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
    
    if (level) query.level = level;
    if (department) query.department = department;
    if (paymentStatus) query.paymentStatus = paymentStatus;

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
  } catch (error) {
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
    
    if (level) query.level = level;
    if (paymentStatus) query.paymentStatus = paymentStatus;

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
  } catch (error) {
    console.error('getStudentsByDepartment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Don't allow direct password updates through this endpoint
    if (updateData.password) {
      delete updateData.password;
    }

    // Don't allow role changes
    if (updateData.role) {
      delete updateData.role;
    }

    // If changing gender, verify no active hostel assignment with wrong gender
    if (updateData.gender) {
      updateData.gender = updateData.gender.toLowerCase();
      if (!['male', 'female'].includes(updateData.gender)) {
        return res.status(400).json({
          success: false,
          message: 'Gender must be either male or female'
        });
      }
    }

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // If changing gender and student has hostel assignment, verify compatibility
    if (updateData.gender && updateData.gender !== student.gender && student.assignedHostel) {
      const hostel = await Hostel.findById(student.assignedHostel);
      if (hostel && hostel.gender !== 'mixed') {
        const isCompatible = (
          (updateData.gender === 'male' && hostel.gender === 'male') ||
          (updateData.gender === 'female' && hostel.gender === 'female')
        );
        
        if (!isCompatible) {
          return res.status(400).json({
            success: false,
            message: `Cannot change gender while assigned to a ${hostel.gender} hostel. Please unassign from hostel first.`
          });
        }
      }
    }

    // Check if matricNo is being changed and if it's unique
    if (updateData.matricNo && updateData.matricNo !== student.matricNo) {
      const existingStudent = await Student.findOne({ 
        matricNo: updateData.matricNo,
        _id: { $ne: id }
      });

      if (existingStudent) {
        return res.status(409).json({
          success: false,
          message: 'A student with this matric number already exists'
        });
      }
    }

    // Check if email is being changed and if it's unique
    if (updateData.email && updateData.email !== student.email) {
      const existingStudent = await Student.findOne({ 
        email: updateData.email,
        _id: { $ne: id }
      });

      if (existingStudent) {
        return res.status(409).json({
          success: false,
          message: 'A student with this email already exists'
        });
      }
    }

    // Update student
    const updatedStudent = await Student.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('college', 'name code')
      .populate('department', 'name code')
      .populate('assignedHostel', 'name code')
      .populate('assignedRoom', 'roomNumber');

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: updatedStudent
    });
  } catch (error) {
    console.error('updateStudent error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent = 'false' } = req.query;

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (permanent === 'true') {
      // Permanent deletion
      await Student.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Student permanently deleted',
        data: {
          id: student._id,
          matricNo: student.matricNo,
          name: `${student.firstName} ${student.lastName}`
        }
      });
    } else {
      // Soft delete (set isActive to false)
      student.isActive = false;
      await student.save();

      res.status(200).json({
        success: true,
        message: 'Student deactivated successfully',
        data: student
      });
    }
  } catch (error) {
    console.error('deleteStudent error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Hostel Management
exports.createHostel = async (req, res) => {
  try {
    console.log('Creating hostel with data:', req.body);
    
    // Validate required fields
    const { name, level, gender, totalRooms } = req.body;
    
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
    
    if (![100, 200, 300, 400, 500].includes(Number(level))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Level must be 100, 200, 300, 400, or 500' 
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
    
    const hostel = await Hostel.create(req.body);
    cacheService.del(cacheService.cacheKeys.hostelsByLevel(hostel.level));
    
    res.status(201).json({ 
      success: true, 
      message: 'Hostel created successfully',
      data: hostel 
    });
  } catch (error) {
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

exports.getHostels = async (req, res) => {
  try {
    const hostels = await Hostel.find({ isActive: true }).populate('portersAssigned');
    res.status(200).json({ success: true, data: hostels });
  } catch (error) {
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

    // Check if name is being changed and if it's unique
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

    // Validate level if provided
    if (updateData.level && ![100, 200, 300, 400, 500].includes(Number(updateData.level))) {
      return res.status(400).json({
        success: false,
        message: 'Level must be 100, 200, 300, 400, or 500'
      });
    }

    // Validate gender if provided
    if (updateData.gender && !['male', 'female', 'mixed'].includes(updateData.gender.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Gender must be male, female, or mixed'
      });
    }

    // Validate totalRooms if provided
    if (updateData.totalRooms && Number(updateData.totalRooms) < 1) {
      return res.status(400).json({
        success: false,
        message: 'Total rooms must be at least 1'
      });
    }

    const updatedHostel = await Hostel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('portersAssigned');

    // Clear cache
    cacheService.del(cacheService.cacheKeys.hostelsByLevel(hostel.level));
    if (updateData.level && updateData.level !== hostel.level) {
      cacheService.del(cacheService.cacheKeys.hostelsByLevel(updateData.level));
    }

    res.status(200).json({
      success: true,
      message: 'Hostel updated successfully',
      data: updatedHostel
    });
  } catch (error) {
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
      // Permanent deletion - delete all associated rooms and bunks
      const rooms = await Room.find({ hostel: id });
      console.log('Deleting', rooms.length, 'rooms');
      
      for (const room of rooms) {
        // Delete bunks associated with this room
        await Bunk.deleteMany({ room: room._id });
      }
      
      // Delete all rooms
      await Room.deleteMany({ hostel: id });
      
      // Delete the hostel
      await Hostel.findByIdAndDelete(id);

      // Clear cache
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
    } else {
      // Soft delete
      hostel.isActive = false;
      await hostel.save();

      // Clear cache
      cacheService.del(cacheService.cacheKeys.hostelsByLevel(hostel.level));

      console.log('Hostel soft deleted');
      return res.status(200).json({
        success: true,
        message: 'Hostel deactivated successfully',
        data: hostel
      });
    }
  } catch (error) {
    console.error('Delete hostel error:', error);
    return res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Room Management
exports.createRoom = async (req, res) => {
  try {
    const room = await Room.create(req.body);
    
    // Auto-create bunks based on capacity
    const numberOfBunks = Math.floor(room.capacity / 2);
    const bunks = [];
    
    for (let i = 1; i <= numberOfBunks; i++) {
      bunks.push({
        bunkNumber: `B${i}`,
        room: room._id,
      });
    }
    
    await Bunk.insertMany(bunks);
    cacheService.del(cacheService.cacheKeys.roomsByHostel(room.hostel));
    
    res.status(201).json({ success: true, data: room });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getRooms = async (req, res) => {
  try {
    const { hostel, status } = req.query;
    const query = { isActive: true };
    if (hostel) query.hostel = hostel;
    if (status) query.status = status;

    const rooms = await Room.find(query).populate('hostel');
    res.status(200).json({ success: true, data: rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    console.log('Updating room with ID:', req.params.id);
    console.log('Update data:', req.body);

    const { roomNumber, hostel, capacity, level } = req.body;
    
    // Check if room exists
    const existingRoom = await Room.findById(req.params.id);
    if (!existingRoom) {
      console.log('Room not found:', req.params.id);
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    // Check if hostel exists if hostel is being updated
    if (hostel && hostel !== existingRoom.hostel.toString()) {
      const hostelExists = await Hostel.findById(hostel);
      if (!hostelExists) {
        return res.status(404).json({ success: false, message: 'Hostel not found' });
      }
    }

    // If capacity is changing, we need to manage bunks
    const oldCapacity = existingRoom.capacity;
    const newCapacity = capacity || oldCapacity;

    const updatedRoom = await Room.findByIdAndUpdate(
      req.params.id,
      { roomNumber, hostel, capacity: newCapacity, level },
      { new: true, runValidators: true }
    ).populate('hostel');

    // Handle bunk changes if capacity changed
    if (oldCapacity !== newCapacity) {
      const oldBunks = Math.floor(oldCapacity / 2);
      const newBunks = Math.floor(newCapacity / 2);

      if (newBunks > oldBunks) {
        // Add more bunks
        const bunksToAdd = [];
        for (let i = oldBunks + 1; i <= newBunks; i++) {
          bunksToAdd.push({
            bunkNumber: `B${i}`,
            room: updatedRoom._id,
          });
        }
        await Bunk.insertMany(bunksToAdd);
      } else if (newBunks < oldBunks) {
        // Remove excess bunks (only if they're not occupied)
        const bunksToRemove = await Bunk.find({
          room: updatedRoom._id,
          $or: [{ upperOccupant: null }, { lowerOccupant: null }]
        }).sort({ bunkNumber: -1 }).limit(oldBunks - newBunks);
        
        for (const bunk of bunksToRemove) {
          if (!bunk.upperOccupant && !bunk.lowerOccupant) {
            await Bunk.findByIdAndDelete(bunk._id);
          }
        }
      }
    }

    // Clear cache
    cacheService.del(cacheService.cacheKeys.roomsByHostel(updatedRoom.hostel._id));

    console.log('Room updated successfully:', updatedRoom);
    res.status(200).json({ success: true, data: updatedRoom });
  } catch (error) {
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

    // Check if room has occupants
    if (room.currentOccupants > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete room with current occupants. Please reassign students first.' 
      });
    }

    // Delete all bunks associated with this room
    await Bunk.deleteMany({ room: room._id });
    
    // Permanently delete the room
    await Room.findByIdAndDelete(req.params.id);
    console.log('Room permanently deleted:', req.params.id);

    // Clear cache
    cacheService.del(cacheService.cacheKeys.roomsByHostel(room.hostel));

    res.status(200).json({ 
      success: true, 
      message: 'Room permanently deleted'
    });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Porter Management
exports.createPorter = async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      password,
      phoneNumber, 
      assignedHostel,
      employeeId,
      shiftSchedule 
    } = req.body;

    console.log('Creating porter:', { firstName, lastName, email });

    // Check if porter already exists
    const existingPorter = await Porter.findOne({ email: email.toLowerCase() });
    if (existingPorter) {
      return res.status(400).json({
        success: false,
        message: 'Porter with this email already exists',
      });
    }

    // Check if employeeId is unique (if provided)
    if (employeeId) {
      const existingEmployeeId = await Porter.findOne({ employeeId });
      if (existingEmployeeId) {
        return res.status(400).json({
          success: false,
          message: 'Employee ID already exists',
        });
      }
    }

    // Validate hostel if provided
    if (assignedHostel) {
      const hostel = await Hostel.findById(assignedHostel);
      if (!hostel) {
        return res.status(404).json({
          success: false,
          message: 'Assigned hostel not found',
        });
      }
    }

    // Create porter
    const porter = await Porter.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: password || 'Porter123', // Default password
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

    // Update hostel if assigned
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
  } catch (error) {
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

    // Update hostel
    await Hostel.findByIdAndUpdate(hostelId, { $push: { portersAssigned: porterId } });

    // Send notification
    await notificationService.notifyPorterApproved(porterId);

    res.status(200).json({ success: true, data: porter });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updatePorter = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      firstName,
      lastName,
      email,
      phoneNumber,
      assignedHostel,
      employeeId,
      shiftSchedule,
      status 
    } = req.body;

    console.log('Updating porter:', id, req.body);

    // Find porter
    const porter = await Porter.findById(id);
    if (!porter) {
      return res.status(404).json({
        success: false,
        message: 'Porter not found',
      });
    }

    // Store old hostel for cleanup
    const oldHostel = porter.assignedHostel;

    // Check if email is being changed and is unique
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

    // Check if employeeId is being changed and is unique
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

    // Validate new hostel if provided
    if (assignedHostel && assignedHostel !== oldHostel?.toString()) {
      const hostel = await Hostel.findById(assignedHostel);
      if (!hostel) {
        return res.status(404).json({
          success: false,
          message: 'Assigned hostel not found',
        });
      }

      // Remove porter from old hostel
      if (oldHostel) {
        await Hostel.findByIdAndUpdate(oldHostel, {
          $pull: { portersAssigned: porter._id }
        });
      }

      // Add porter to new hostel
      await Hostel.findByIdAndUpdate(assignedHostel, {
        $addToSet: { portersAssigned: porter._id }
      });

      porter.assignedHostel = assignedHostel;
    }

    // Update other fields
    if (firstName) porter.firstName = firstName;
    if (lastName) porter.lastName = lastName;
    if (phoneNumber) porter.phoneNumber = phoneNumber;
    if (shiftSchedule !== undefined) porter.shiftSchedule = shiftSchedule;
    if (status) porter.status = status;

    await porter.save();

    // Populate hostel details
    await porter.populate('assignedHostel', 'name code location gender');

    console.log('Porter updated successfully:', porter._id);

    res.status(200).json({
      success: true,
      message: 'Porter updated successfully',
      data: porter,
    });
  } catch (error) {
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

    // Remove porter from assigned hostel
    if (porter.assignedHostel) {
      await Hostel.findByIdAndUpdate(porter.assignedHostel, {
        $pull: { portersAssigned: porter._id }
      });
    }

    // Delete porter
    await Porter.findByIdAndDelete(id);

    console.log('Porter deleted successfully:', id);

    res.status(200).json({
      success: true,
      message: 'Porter deleted successfully',
    });
  } catch (error) {
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

    // Validate required fields
    if (!porterId || !hostelId) {
      return res.status(400).json({
        success: false,
        message: 'Porter ID and Hostel ID are required',
      });
    }

    // Check if porter exists
    const porter = await Porter.findById(porterId);
    if (!porter) {
      return res.status(404).json({
        success: false,
        message: 'Porter not found',
      });
    }

    // Check if hostel exists
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found',
      });
    }

    // Store old hostel for cleanup
    const oldHostel = porter.assignedHostel;

    // Remove porter from old hostel if exists
    if (oldHostel && oldHostel.toString() !== hostelId) {
      await Hostel.findByIdAndUpdate(oldHostel, {
        $pull: { portersAssigned: porter._id }
      });
    }

    // Add porter to new hostel's portersAssigned array
    await Hostel.findByIdAndUpdate(hostelId, {
      $addToSet: { portersAssigned: porter._id }
    });

    // Update porter with new hostel assignment
    porter.assignedHostel = hostelId;
    await porter.save();

    // Populate the hostel details for response
    await porter.populate('assignedHostel', 'name code location gender');

    console.log('Hostel assigned successfully to porter:', porter._id);

    res.status(200).json({
      success: true,
      message: `Hostel "${hostel.name}" assigned successfully to ${porter.firstName} ${porter.lastName}`,
      data: porter,
    });

  } catch (error) {
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

    // Transform data to include name field and format response
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Dashboard stats
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
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// College Statistics
exports.getCollegeStatistics = async (req, res) => {
  try {
    const colleges = await College.find({ isActive: true }).lean();

    // Get all student counts in one aggregation
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

    // Get department counts per college
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

    // Create college count maps
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
  } catch (error) {
    console.error('getCollegeStatistics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Universal Search
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

    // Validate ObjectId filters
    const mongoose = require('mongoose');
    const isValidObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id);

    // Search Students
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

      // Apply additional filters only if they are valid ObjectIds
      if (college && isValidObjectId(college)) studentFilter.college = college;
      if (level) studentFilter.level = parseInt(level);
      if (department && isValidObjectId(department)) studentFilter.department = department;
      if (status) {
        if (status === 'paid') studentFilter.paymentStatus = 'paid';
        if (status === 'unpaid') studentFilter.paymentStatus = { $in: ['pending', 'failed'] };
        if (status === 'reserved') studentFilter.reservationStatus = { $in: ['temporary', 'confirmed'] };
        if (status === 'checked_in') studentFilter.reservationStatus = 'checked_in';
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

    // Search Colleges
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

    // Search Departments
    if (!type || type === 'departments' || type === 'all') {
      const departmentFilter = {
        isActive: true,
        $or: [
          { name: { $regex: searchQuery, $options: 'i' } },
          { code: { $regex: searchQuery, $options: 'i' } }
        ]
      };

      if (college && isValidObjectId(college)) departmentFilter.college = college;

      const departments = await Department.find(departmentFilter)
        .populate('college', 'name code')
        .limit(parseInt(limit))
        .skip(skip);

      results.departments = departments;
      results.departmentsCount = await Department.countDocuments(departmentFilter);
    }

    // Search Hostels
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

    // Search Rooms
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

    // Search Porters
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
        if (status === 'approved') porterFilter.approved = true;
        if (status === 'pending') porterFilter.approved = false;
      }

      const porters = await Porter.find(porterFilter)
        .populate('hostel', 'name code location')
        .limit(parseInt(limit))
        .skip(skip)
        .sort({ createdAt: -1 });

      results.porters = porters;
      results.portersCount = await Porter.countDocuments(porterFilter);
    }

    // Calculate total results
    const totalResults = 
      (results.studentsCount || 0) +
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

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
