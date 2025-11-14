const Student = require('../models/Student');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Bunk = require('../models/Bunk');
const notificationService = require('../services/notificationService');
const cacheService = require('../services/cacheService');
const { addHours } = require('../utils/dateUtils');
const config = require('../config/env');

/**
 * @desc    Get available hostels for student's level
 * @route   GET /api/student/hostels
 * @access  Private (Student)
 */
exports.getAvailableHostels = async (req, res) => {
  try {
    const student = req.user;
    
    const hostels = await Hostel.find({
      level: student.level,
      isActive: true,
    }).populate('portersAssigned');

    res.status(200).json({
      success: true,
      data: hostels,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get available rooms in a hostel
 * @route   GET /api/student/hostels/:hostelId/rooms
 * @access  Private (Student)
 */
exports.getAvailableRooms = async (req, res) => {
  try {
    const { hostelId } = req.params;
    
    const rooms = await Room.find({
      hostel: hostelId,
      isActive: true,
      status: { $in: ['available', 'partially_occupied'] },
    }).populate('bunks');

    res.status(200).json({
      success: true,
      data: rooms,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get available bunks in a room
 * @route   GET /api/student/rooms/:roomId/bunks
 * @access  Private (Student)
 */
exports.getAvailableBunks = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const bunks = await Bunk.find({
      room: roomId,
      status: 'available',
      isActive: true,
    });

    res.status(200).json({
      success: true,
      data: bunks,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Reserve a room/bunk
 * @route   POST /api/student/reserve
 * @access  Private (Student with payment)
 */
exports.reserveRoom = async (req, res) => {
  try {
    const student = req.user;
    const { roomId, bunkId, roommates } = req.body;

    // Check payment status
    if (student.paymentStatus !== 'paid') {
      return res.status(403).json({
        success: false,
        message: 'Payment required before reservation',
      });
    }

    // Check if already reserved
    if (student.reservationStatus === 'confirmed' || student.reservationStatus === 'checked_in') {
      return res.status(400).json({
        success: false,
        message: 'You already have an active reservation',
      });
    }

    // Get room and bunk
    const room = await Room.findById(roomId).populate('hostel');
    const bunk = await Bunk.findById(bunkId);

    if (!room || !bunk) {
      return res.status(404).json({
        success: false,
        message: 'Room or bunk not found',
      });
    }

    // Check bunk availability
    if (bunk.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Bunk is not available',
      });
    }

    // Check room capacity
    if (room.currentOccupants >= room.capacity) {
      return res.status(400).json({
        success: false,
        message: 'Room is full',
      });
    }

    // Reserve bunk
    bunk.status = 'reserved';
    bunk.occupiedByStudent = student._id;
    bunk.reservedUntil = addHours(new Date(), config.RESERVATION_EXPIRY_HOURS);
    await bunk.save();

    // Update student
    student.assignedHostel = room.hostel._id;
    student.assignedRoom = room._id;
    student.assignedBunk = bunk._id;
    student.reservationStatus = 'confirmed';
    student.reservationExpiresAt = bunk.reservedUntil;
    
    // Handle roommates
    if (roommates && roommates.length > 0) {
      student.roommates = roommates;
      
      // Notify roommates
      for (const roommateId of roommates) {
        await notificationService.notifyRoommateReserved(
          roommateId,
          student._id,
          room._id,
          room.hostel._id
        );
      }
    }
    
    await student.save();

    // Update room occupancy
    room.currentOccupants += 1;
    await room.updateStatus();

    // Send confirmation email
    await notificationService.notifyReservationConfirmed(
      student._id,
      room._id,
      bunk._id,
      room.hostel._id
    );

    // Clear cache
    cacheService.del(cacheService.cacheKeys.availableRooms(student.level));

    res.status(200).json({
      success: true,
      message: 'Room reserved successfully',
      data: {
        hostel: room.hostel.name,
        room: room.roomNumber,
        bunk: bunk.bunkNumber,
        expiresAt: bunk.reservedUntil,
      },
    });
  } catch (error) {
    console.error('Reserve room error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get student's reservation details
 * @route   GET /api/student/reservation
 * @access  Private (Student)
 */
exports.getReservation = async (req, res) => {
  try {
    const student = await Student.findById(req.user._id)
      .populate('assignedHostel assignedRoom assignedBunk roommates');

    res.status(200).json({
      success: true,
      data: {
        reservationStatus: student.reservationStatus,
        hostel: student.assignedHostel,
        room: student.assignedRoom,
        bunk: student.assignedBunk,
        roommates: student.roommates,
        expiresAt: student.reservationExpiresAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get student dashboard
 * @route   GET /api/student/dashboard
 * @access  Private (Student)
 */
exports.getDashboard = async (req, res) => {
  try {
    const student = await Student.findById(req.user._id)
      .populate('college department assignedHostel assignedRoom assignedBunk');

    res.status(200).json({
      success: true,
      data: {
        profile: student,
        paymentStatus: student.paymentStatus,
        reservationStatus: student.reservationStatus,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
