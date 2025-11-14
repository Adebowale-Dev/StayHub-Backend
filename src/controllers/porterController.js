const Porter = require('../models/Porter');
const Student = require('../models/Student');
const Room = require('../models/Room');
const Bunk = require('../models/Bunk');
const { generateDefaultPassword } = require('../utils/passwordUtils');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

/**
 * @desc    Submit porter application
 * @route   POST /api/porter/apply
 * @access  Public
 */
exports.applyAsPorter = async (req, res) => {
  try {
    const { firstName, lastName, email, phone } = req.body;

    // Check if email already exists
    const existingPorter = await Porter.findOne({ email: email.toLowerCase() });
    if (existingPorter) {
      return res.status(400).json({
        success: false,
        message: 'Application already exists with this email',
      });
    }

    // Create porter application
    const porter = await Porter.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password: generateDefaultPassword(firstName),
      status: 'pending',
      approved: false,
    });

    // Send confirmation email
    await emailService.sendApplicationReceivedEmail(email, firstName);

    // Notify admin
    await notificationService.notifyAdminNewPorterApplication(email);

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully. You will be notified once reviewed.',
    });
  } catch (error) {
    console.error('Porter application error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get porter dashboard
 * @route   GET /api/porter/dashboard
 * @access  Private (Porter)
 */
exports.getDashboard = async (req, res) => {
  try {
    const porter = req.user;

    if (!porter.assignedHostel) {
      return res.status(200).json({
        success: true,
        data: {
          message: 'No hostel assigned yet',
          porter,
        },
      });
    }

    // Get students in assigned hostel
    const students = await Student.find({
      assignedHostel: porter.assignedHostel,
      reservationStatus: { $in: ['confirmed', 'checked_in'] },
    }).populate('assignedRoom assignedBunk');

    const totalStudents = students.length;
    const checkedInStudents = students.filter(s => s.reservationStatus === 'checked_in').length;

    res.status(200).json({
      success: true,
      data: {
        porter,
        stats: {
          totalStudents,
          checkedInStudents,
          pendingCheckIn: totalStudents - checkedInStudents,
        },
        recentReservations: students.slice(0, 10),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get students in porter's hostel
 * @route   GET /api/porter/students
 * @access  Private (Porter)
 */
exports.getStudents = async (req, res) => {
  try {
    const porter = req.user;

    if (!porter.assignedHostel) {
      return res.status(403).json({
        success: false,
        message: 'No hostel assigned',
      });
    }

    const { status, page = 1, limit = 50 } = req.query;
    const query = { assignedHostel: porter.assignedHostel };

    if (status) query.reservationStatus = status;

    const students = await Student.find(query)
      .populate('assignedRoom assignedBunk')
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

/**
 * @desc    Mark student as checked in
 * @route   POST /api/porter/checkin/:studentId
 * @access  Private (Porter)
 */
exports.checkInStudent = async (req, res) => {
  try {
    const porter = req.user;
    const { studentId } = req.params;
    const { paymentCode } = req.body;

    const student = await Student.findById(studentId)
      .populate('assignedRoom assignedBunk');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Verify student is in porter's hostel
    if (student.assignedHostel.toString() !== porter.assignedHostel.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Student is not in your assigned hostel',
      });
    }

    // Verify payment code
    if (student.paymentCode !== paymentCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment code',
      });
    }

    // Update student status
    student.reservationStatus = 'checked_in';
    await student.save();

    // Update bunk status
    const bunk = await Bunk.findById(student.assignedBunk);
    bunk.status = 'occupied';
    await bunk.save();

    res.status(200).json({
      success: true,
      message: 'Student checked in successfully',
      data: student,
    });
  } catch (error) {
    console.error('Check in error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get rooms in porter's hostel
 * @route   GET /api/porter/rooms
 * @access  Private (Porter)
 */
exports.getRooms = async (req, res) => {
  try {
    const porter = req.user;

    if (!porter.assignedHostel) {
      return res.status(403).json({
        success: false,
        message: 'No hostel assigned',
      });
    }

    const rooms = await Room.find({ hostel: porter.assignedHostel })
      .populate('students');

    res.status(200).json({
      success: true,
      data: rooms,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Release expired reservations
 * @route   POST /api/porter/release-expired
 * @access  Private (Porter)
 */
exports.releaseExpiredReservations = async (req, res) => {
  try {
    const porter = req.user;

    if (!porter.assignedHostel) {
      return res.status(403).json({
        success: false,
        message: 'No hostel assigned',
      });
    }

    // Find expired reservations
    const expiredStudents = await Student.find({
      assignedHostel: porter.assignedHostel,
      reservationStatus: 'confirmed',
      reservationExpiresAt: { $lt: new Date() },
    });

    for (const student of expiredStudents) {
      // Release bunk
      await Bunk.findByIdAndUpdate(student.assignedBunk, {
        status: 'available',
        occupiedByStudent: null,
        reservedUntil: null,
      });

      // Update room occupancy
      const room = await Room.findById(student.assignedRoom);
      room.currentOccupants = Math.max(0, room.currentOccupants - 1);
      await room.updateStatus();

      // Update student
      student.reservationStatus = 'expired';
      await student.save();
    }

    res.status(200).json({
      success: true,
      message: `${expiredStudents.length} expired reservations released`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
