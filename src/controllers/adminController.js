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
    const department = await Department.create(req.body);
    res.status(201).json({ success: true, data: department });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getDepartments = async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true }).populate('college');
    res.status(200).json({ success: true, data: departments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
      .populate('college department assignedHostel assignedRoom')
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
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

// Hostel Management
exports.createHostel = async (req, res) => {
  try {
    const hostel = await Hostel.create(req.body);
    cacheService.del(cacheService.cacheKeys.hostelsByLevel(hostel.level));
    res.status(201).json({ success: true, data: hostel });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
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

// Porter Management
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

exports.getPorters = async (req, res) => {
  try {
    const porters = await Porter.find().populate('assignedHostel');
    res.status(200).json({ success: true, data: porters });
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
