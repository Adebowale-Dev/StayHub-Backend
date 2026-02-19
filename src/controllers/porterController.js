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

    console.log('==================== CHECK-IN REQUEST ====================');
    console.log('Porter ID:', porter._id);
    console.log('Porter Assigned Hostel:', porter.assignedHostel);
    console.log('Student ID:', studentId);
    console.log('Payment Code:', paymentCode);

    const student = await Student.findById(studentId)
      .populate('assignedRoom assignedBunk assignedHostel');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    console.log('Student Found:', `${student.firstName} ${student.lastName}`);
    console.log('Student Assigned Hostel (raw):', student.assignedHostel);
    console.log('Student Assigned Hostel ID:', student.assignedHostel?._id || student.assignedHostel);
    console.log('Student Reservation Status:', student.reservationStatus);
    console.log('Student Payment Code:', student.paymentCode);
    
    // Get the actual hostel IDs for comparison
    const studentHostelId = (student.assignedHostel?._id || student.assignedHostel)?.toString();
    // Porter's assignedHostel might be populated or just an ID
    const porterHostelId = (porter.assignedHostel?._id || porter.assignedHostel)?.toString();
    
    console.log('Comparison - Student Hostel:', studentHostelId);
    console.log('Comparison - Porter Hostel:', porterHostelId);
    console.log('Match:', studentHostelId === porterHostelId);
    console.log('==========================================================');

    // Verify student is in porter's hostel
    if (studentHostelId !== porterHostelId) {
      console.log('❌ HOSTEL MISMATCH!');
      return res.status(403).json({
        success: false,
        message: 'Student is not in your assigned hostel',
        debug: {
          studentHostelId: studentHostelId,
          porterHostelId: porterHostelId,
          studentName: `${student.firstName} ${student.lastName}`,
          studentHostelName: student.assignedHostel?.name || 'Not assigned'
        }
      });
    }

    // Verify payment code (optional check - allow check-in even without payment code for now)
    if (paymentCode && student.paymentCode !== paymentCode) {
      console.log('❌ PAYMENT CODE MISMATCH!');
      console.log('Expected:', student.paymentCode, 'Received:', paymentCode);
      return res.status(400).json({
        success: false,
        message: 'Invalid payment code',
      });
    }

    console.log('✅ All validations passed. Checking in student...');

    // Update student status
    student.reservationStatus = 'checked_in';
    student.checkInDate = new Date();
    await student.save();

    console.log('✅ Student status updated to checked_in');

    // Update bunk status
    const bunk = await Bunk.findById(student.assignedBunk);
    if (bunk) {
      bunk.status = 'occupied';
      await bunk.save();
      console.log('✅ Bunk status updated to occupied');
    }

    console.log('✅ CHECK-IN SUCCESSFUL!');
    console.log('==========================================================');

    // Fetch fresh student data to return
    const updatedStudent = await Student.findById(studentId)
      .populate('assignedRoom assignedBunk assignedHostel')
      .select('-password');

    console.log('Updated student reservation status:', updatedStudent.reservationStatus);
    console.log('Updated student check-in date:', updatedStudent.checkInDate);

    res.status(200).json({
      success: true,
      message: 'Student checked in successfully',
      data: updatedStudent,
    });
  } catch (error) {
    console.error('Check in error:', error);
    console.error('Error stack:', error.stack);
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
      .populate('hostel', 'name')
      .populate('students')
      .select('roomNumber floor capacity currentOccupants level hostel status')
      .sort({ roomNumber: 1 });

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
