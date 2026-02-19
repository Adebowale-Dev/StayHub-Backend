const Student = require('../models/Student');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Bunk = require('../models/Bunk');
const Department = require('../models/Department');
const notificationService = require('../services/notificationService');
const cacheService = require('../services/cacheService');
const { addHours } = require('../utils/dateUtils');
const config = require('../config/env');

/**
 * @desc    Update student profile
 * @route   PATCH /api/student/profile
 * @access  Private (Student)
 */
exports.updateProfile = async (req, res) => {
  try {
    const studentId = req.user._id;
    const updateData = req.body;

    console.log('Updating student profile:', studentId);
    console.log('Update data:', updateData);

    // Build update object with only provided fields
    const studentUpdate = {};

    // Validate and add fields
    if (updateData.firstName !== undefined) {
      if (typeof updateData.firstName !== 'string' || updateData.firstName.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'First name must be a non-empty string'
        });
      }
      studentUpdate.firstName = updateData.firstName.trim();
    }

    if (updateData.lastName !== undefined) {
      if (typeof updateData.lastName !== 'string' || updateData.lastName.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Last name must be a non-empty string'
        });
      }
      studentUpdate.lastName = updateData.lastName.trim();
    }

    // Email validation and uniqueness check
    if (updateData.email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateData.email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Check if email already exists
      const existingStudent = await Student.findOne({
        email: updateData.email.toLowerCase(),
        _id: { $ne: studentId }
      });

      if (existingStudent) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use by another student'
        });
      }

      studentUpdate.email = updateData.email.toLowerCase();
    }

    if (updateData.phoneNumber !== undefined) {
      studentUpdate.phoneNumber = updateData.phoneNumber.trim();
    }

    // Department validation
    if (updateData.department !== undefined) {
      const departmentExists = await Department.findById(updateData.department);
      if (!departmentExists) {
        return res.status(400).json({
          success: false,
          message: 'Invalid department'
        });
      }
      studentUpdate.department = updateData.department;
    }

    // Level validation
    if (updateData.level !== undefined) {
      const validLevels = [100, 200, 300, 400, 500];
      const levelNum = parseInt(updateData.level);
      
      if (!validLevels.includes(levelNum)) {
        return res.status(400).json({
          success: false,
          message: 'Level must be one of: 100, 200, 300, 400, 500'
        });
      }
      studentUpdate.level = levelNum;
    }

    // Matric number validation and uniqueness check
    if (updateData.matricNumber !== undefined) {
      const matricNo = updateData.matricNumber.toUpperCase().trim();
      
      // Check if matricNo already exists
      const existingStudent = await Student.findOne({
        matricNo: matricNo,
        _id: { $ne: studentId }
      });

      if (existingStudent) {
        return res.status(400).json({
          success: false,
          message: 'Matriculation number already in use'
        });
      }

      studentUpdate.matricNo = matricNo;
    }

    // Gender validation
    if (updateData.gender !== undefined) {
      if (!['male', 'female'].includes(updateData.gender.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: 'Gender must be either "male" or "female"'
        });
      }
      studentUpdate.gender = updateData.gender.toLowerCase();
    }

    // Check if there's anything to update
    if (Object.keys(studentUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update'
      });
    }

    // Update student
    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      studentUpdate,
      { new: true, runValidators: true }
    )
      .select('-password')
      .populate('college', 'name code')
      .populate('department', 'name code')
      .populate('assignedHostel', 'name')
      .populate('assignedRoom', 'roomNumber')
      .populate('assignedBunk', 'bunkNumber');

    if (!updatedStudent) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    console.log('Profile updated successfully:', updatedStudent._id);

    // Format response to match the requested structure
    const userData = {
      _id: updatedStudent._id,
      firstName: updatedStudent.firstName,
      lastName: updatedStudent.lastName,
      matricNumber: updatedStudent.matricNo,
      email: updatedStudent.email,
      phoneNumber: updatedStudent.phoneNumber,
      department: updatedStudent.department?.name || updatedStudent.department,
      level: updatedStudent.level,
      gender: updatedStudent.gender,
      role: updatedStudent.role,
      college: updatedStudent.college,
      assignedHostel: updatedStudent.assignedHostel,
      assignedRoom: updatedStudent.assignedRoom,
      assignedBunk: updatedStudent.assignedBunk,
      paymentStatus: updatedStudent.paymentStatus,
      reservationStatus: updatedStudent.reservationStatus
    };

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: userData
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating profile'
    });
  }
};

/**
 * @desc    Get available hostels for student's level
 * @route   GET /api/student/hostels
 * @access  Private (Student)
 */
exports.getAvailableHostels = async (req, res) => {
  try {
    const student = req.user;
    
    // Filter hostels by level and gender
    // Students can only see hostels that match their gender or are mixed
    const genderFilter = student.gender === 'male' 
      ? { gender: { $in: ['male', 'mixed'] } }
      : { gender: { $in: ['female', 'mixed'] } };
    
    const hostels = await Hostel.find({
      level: student.level,
      isActive: true,
      ...genderFilter
    }).populate('portersAssigned');

    // Add availability data for each hostel
    const hostelsWithAvailability = await Promise.all(
      hostels.map(async (hostel) => {
        // Get all rooms for this hostel
        const rooms = await Room.find({ hostel: hostel._id });
        
        // Calculate total capacity from room definitions
        const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);

        // Live occupant count: students who have an active reservation (confirmed)
        // OR are already checked in — queried directly from the Student collection
        // so it is always accurate and never stale.
        const currentOccupants = await Student.countDocuments({
          assignedHostel: hostel._id,
          reservationStatus: { $in: ['confirmed', 'checked_in'] },
        });

        // Derived available capacity — never stored, always computed
        const availableCapacity = Math.max(0, totalCapacity - currentOccupants);
        
        // Calculate available rooms (rooms that still have available bunks)
        const availableRoomsCount = rooms.filter(
          room => room.currentOccupants < room.capacity
        ).length;
        
        // Calculate occupancy rate
        const occupancyRate = totalCapacity > 0 
          ? Math.round((currentOccupants / totalCapacity) * 100) 
          : 0;
        
        return {
          _id: hostel._id,
          name: hostel.name,
          code: hostel.code,
          location: hostel.location,
          totalRooms: hostel.totalRooms,
          totalCapacity: totalCapacity,
          currentOccupants: currentOccupants,
          availableCapacity: availableCapacity,
          gender: hostel.gender,
          level: hostel.level,
          isActive: hostel.isActive,
          description: hostel.description,
          portersAssigned: hostel.portersAssigned,
          availableRooms: availableRoomsCount,
          occupancyRate: occupancyRate,
          createdAt: hostel.createdAt,
          updatedAt: hostel.updatedAt
        };
      })
    );

    res.status(200).json({
      success: true,
      data: hostelsWithAvailability,
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
    
    // Get ALL active rooms, don't filter by status field
    // We'll calculate real-time availability from bunks instead
    const rooms = await Room.find({
      hostel: hostelId,
      isActive: true,
    })
      .populate('bunks')
      .lean();

    // Add availability information to each room
    const roomsWithAvailability = rooms.map(room => {
      const totalBunks = room.bunks?.length || 0;

      const availableBunks = room.bunks?.filter(
        bunk => bunk.status === 'available' && bunk.isActive
      ).length || 0;

      // Count reserved + occupied as "taken" so currentOccupants reflects real usage
      const takenBunks = room.bunks?.filter(
        bunk => bunk.status === 'occupied' || bunk.status === 'reserved'
      ).length || 0;

      const reservedBunks = room.bunks?.filter(
        bunk => bunk.status === 'reserved'
      ).length || 0;

      return {
        ...room,
        // Use actual bunk count as the true capacity (capacity/2 bunks are created by admin)
        capacity: totalBunks,
        currentOccupants: takenBunks,       // reserved + occupied
        availableSpaces: availableBunks,    // only truly free bunks
        reservedSpaces: reservedBunks,
        isAvailable: availableBunks > 0,
      };
    });

    res.status(200).json({
      success: true,
      data: roomsWithAvailability,
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
    const { roomId, bunkId, roommates, isGroupReservation } = req.body;

    // Check payment status
    if (student.paymentStatus !== 'paid') {
      console.log('❌ Payment required');
      return res.status(403).json({
        success: false,
        message: 'Payment required before reservation',
      });
    }

    // Check if already reserved
    if (student.reservationStatus === 'confirmed' || student.reservationStatus === 'checked_in') {
      console.log('❌ Already reserved:', student.reservationStatus);
      return res.status(400).json({
        success: false,
        message: 'You already have an active reservation',
      });
    }

    // Get room with bunks
    const room = await Room.findById(roomId).populate('hostel');
    console.log('Room found:', room ? `${room.roomNumber} (${room._id})` : 'Not found');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found or no longer available',
      });
    }

    console.log('Room details:', {
      number: room.roomNumber,
      floor: room.floor,
      capacity: room.capacity,
      currentOccupants: room.currentOccupants,
      status: room.status,
      hostel: room.hostel.name
    });

    // For group reservations, check if room has enough space
    if (isGroupReservation && roommates && roommates.length > 0) {
      const requiredBunks = roommates.length + 1; // Include requesting student
      const availableSpace = room.capacity - room.currentOccupants;
      
      console.log('Group reservation check:', {
        requiredBunks,
        availableSpace,
        roommates: roommates.length
      });

      if (availableSpace < requiredBunks) {
        return res.status(400).json({
          success: false,
          message: `Insufficient space. Room has ${availableSpace} available bunks, but you need ${requiredBunks} for your group`,
        });
      }

      // Verify all roommates are valid and haven't reserved yet
      for (const roommateId of roommates) {
        const roommate = await Student.findById(roommateId);
        
        if (!roommate) {
          return res.status(404).json({
            success: false,
            message: `Roommate with ID ${roommateId} not found`,
          });
        }

        if (roommate.reservationStatus === 'confirmed' || roommate.reservationStatus === 'checked_in') {
          return res.status(400).json({
            success: false,
            message: `${roommate.firstName} ${roommate.lastName} already has a reservation`,
          });
        }

        if (roommate.paymentStatus !== 'paid') {
          return res.status(400).json({
            success: false,
            message: `${roommate.firstName} ${roommate.lastName} has not completed payment`,
          });
        }
      }
    }

    // Get bunk - either specific one or first available
    let bunk;
    if (bunkId) {
      bunk = await Bunk.findById(bunkId);
      console.log('✓ Specific bunk requested:', bunk ? bunk.bunkNumber : 'Not found');
      
      if (!bunk) {
        return res.status(404).json({
          success: false,
          message: 'Bunk not found',
        });
      }

      // Verify bunk belongs to the room
      if (bunk.room.toString() !== room._id.toString()) {
        console.log('❌ Bunk-room mismatch:', { bunkRoom: bunk.room, roomId: room._id });
        return res.status(400).json({
          success: false,
          message: 'Selected bunk does not belong to this room',
        });
      }

      // Check bunk availability
      if (bunk.status !== 'available') {
        console.log('Bunk not available:', bunk.status);
        return res.status(400).json({
          success: false,
          message: 'Bunk is not available',
        });
      }
    } else {
      // Auto-select first available bunk in the room
      bunk = await Bunk.findOne({
        room: room._id,
        status: 'available',
        isActive: true
      });
      console.log('✓ Auto-selected bunk:', bunk ? bunk.bunkNumber : 'None available');
      
      if (!bunk) {
        return res.status(404).json({
          success: false,
          message: 'No available bunks in this room',
        });
      }
    }

    // Check room capacity
    if (room.currentOccupants >= room.capacity) {
      console.log('Room full:', { current: room.currentOccupants, capacity: room.capacity });
      return res.status(400).json({
        success: false,
        message: 'Room is full',
      });
    }

    // Reserve bunk for primary student
    bunk.status = 'reserved';
    bunk.occupiedByStudent = student._id;
    bunk.reservedUntil = addHours(new Date(), config.RESERVATION_EXPIRY_HOURS);
    await bunk.save();

    // Update primary student
    // Update primary student
    student.assignedHostel = room.hostel._id;
    student.assignedRoom = room._id;
    student.assignedBunk = bunk._id;
    student.reservationStatus = 'confirmed';
    student.reservedAt = new Date();
    student.reservationExpiresAt = bunk.reservedUntil;
    
    let roommateDetails = [];
    
    // Handle group reservation - assign bunks to roommates
    if (isGroupReservation && roommates && roommates.length > 0) {
      student.roommates = roommates;
      
      console.log(`🤝 Processing group reservation for ${roommates.length} roommates...`);
      
      for (const roommateId of roommates) {
        // Find available bunk for this roommate
        const roommateBunk = await Bunk.findOne({
          room: room._id,
          status: 'available',
          isActive: true
        });

        if (!roommateBunk) {
          // Rollback primary student's reservation
          bunk.status = 'available';
          bunk.occupiedByStudent = null;
          bunk.reservedUntil = null;
          await bunk.save();
          
          return res.status(400).json({
            success: false,
            message: 'Not enough available bunks for group reservation',
          });
        }

        // Reserve bunk for roommate
        roommateBunk.status = 'reserved';
        roommateBunk.occupiedByStudent = roommateId;
        roommateBunk.reservedUntil = bunk.reservedUntil;
        await roommateBunk.save();

        // Update roommate student record
        const roommateStudent = await Student.findById(roommateId);
        roommateStudent.assignedHostel = room.hostel._id;
        roommateStudent.assignedRoom = room._id;
        roommateStudent.assignedBunk = roommateBunk._id;
        roommateStudent.reservationStatus = 'confirmed';
        roommateStudent.reservedAt = new Date();
        roommateStudent.reservationExpiresAt = bunk.reservedUntil;
        roommateStudent.roommates = [student._id, ...roommates.filter(id => id !== roommateId)];
        await roommateStudent.save();

        roommateDetails.push({
          id: roommateStudent._id,
          name: `${roommateStudent.firstName} ${roommateStudent.lastName}`,
          bunk: roommateBunk.bunkNumber
        });

        // Update room occupancy for each roommate
        room.currentOccupants += 1;
        await room.save();

        // Notify roommate
        await notificationService.notifyRoommateReserved(
          roommateId,
          student._id,
          room._id,
          room.hostel._id
        );
        
        console.log(`✅ Reserved bunk ${roommateBunk.bunkNumber} for ${roommateStudent.firstName} ${roommateStudent.lastName}`);
      }
    } else if (roommates && roommates.length > 0) {
      // Legacy support - just save roommate IDs without auto-assigning
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

    // Update room occupancy for primary student
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

    console.log('✅ Reservation successful:', {
      studentId: student._id,
      hostel: room.hostel.name,
      room: room.roomNumber,
      bunk: bunk.bunkNumber,
      isGroupReservation,
      roommatesAssigned: roommateDetails.length
    });
    console.log('=============================================================');

    const responseData = {
      hostel: room.hostel.name,
      hostelId: room.hostel._id,
      room: room.roomNumber,
      roomId: room._id,
      bunk: bunk.bunkNumber,
      bunkId: bunk._id,
      expiresAt: bunk.reservedUntil,
    };

    if (isGroupReservation && roommateDetails.length > 0) {
      responseData.groupMembers = roommateDetails;
      responseData.totalReserved = roommateDetails.length + 1;
    }

    res.status(200).json({
      success: true,
      message: isGroupReservation 
        ? `Group reservation successful! Reserved ${roommateDetails.length + 1} bunks.`
        : 'Room reserved successfully',
      data: responseData,
    });
  } catch (error) {
    console.error('Reserve room error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to reserve room',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
      .populate('assignedHostel assignedBunk')
      .populate({
        path: 'assignedRoom',
        select: 'roomNumber floor capacity currentOccupants status hostel',
      })
      .populate({
        path: 'roommates',
        select: 'firstName lastName matricNo level department',
      });

    // No active reservation — return 404
    if (!student.assignedRoom || student.reservationStatus === 'none') {
      return res.status(404).json({ message: 'No reservation found' });
    }

    // Backfill reservedAt for reservations made before the field was added.
    // Use updateOne so the populated document in memory is NOT touched.
    if (!student.reservedAt) {
      const fallback = student.updatedAt || student.createdAt;
      await Student.updateOne(
        { _id: student._id },
        { $set: { reservedAt: fallback } }
      );
      student.reservedAt = fallback; // reflect in the current response
    }

    // Compute live occupancy from the DB in case currentOccupants is stale
    const occupantCount = await Student.countDocuments({
      assignedRoom: student.assignedRoom._id,
      reservationStatus: { $in: ['confirmed', 'checked_in'] },
    });

    const room = student.assignedRoom.toObject();
    room.currentOccupants = occupantCount;
    room.availableSpaces = room.capacity - occupantCount;

    res.status(200).json({
      _id: student._id,
      reservationStatus: student.reservationStatus,
      reservedAt: student.reservedAt,
      expiresAt: student.reservationExpiresAt,
      hostel: student.assignedHostel,
      room,
      bunk: student.assignedBunk,
      roommates: student.roommates || [],
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

/**
 * @desc    Create room reservation (Alternative endpoint for frontend compatibility)
 * @route   POST /api/student/reservations
 * @access  Private (Student)
 */
exports.createReservation = async (req, res) => {
  try {
    const { roomId, hostelId, friends, isGroupReservation } = req.body;
    const student = req.user;

    console.log('📋 Room reservation request:', {
      studentId: student._id,
      roomId,
      hostelId,
      isGroupReservation,
      friendsCount: friends?.length || 0
    });

    // 1. Check payment status
    if (student.paymentStatus !== 'paid') {
      return res.status(403).json({
        success: false,
        message: 'Payment required before reservation'
      });
    }

    // 2. Check if student already has a reservation
    if (student.reservationStatus === 'confirmed' || student.reservationStatus === 'checked_in') {
      return res.status(400).json({
        success: false,
        message: 'You already have an active reservation. Please cancel it first.'
      });
    }

    // 3. Validate room exists
    const room = await Room.findById(roomId).populate('hostel');
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found or no longer available'
      });
    }

    // 4. Validate hostel matches
    if (room.hostel._id.toString() !== hostelId) {
      return res.status(400).json({
        success: false,
        message: 'Room does not belong to the selected hostel'
      });
    }

    // 5. Check room capacity
    const requiredBunks = isGroupReservation ? (friends.length + 1) : 1;
    const availableSpace = room.capacity - room.currentOccupants;
    
    if (availableSpace < requiredBunks) {
      return res.status(400).json({
        success: false,
        message: `Insufficient space. Room has ${availableSpace} available bunks, but ${requiredBunks} needed.`
      });
    }

    // 6. For group reservations, validate friends by matric number
    let roommateIds = [];
    if (isGroupReservation && friends && friends.length > 0) {
      const friendStudents = await Student.find({
        matricNo: { $in: friends }
      });

      if (friendStudents.length !== friends.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more friend matric numbers not found'
        });
      }

      // Check if any friend already has a reservation
      for (const friend of friendStudents) {
        if (friend.reservationStatus === 'confirmed' || friend.reservationStatus === 'checked_in') {
          return res.status(400).json({
            success: false,
            message: `${friend.firstName} ${friend.lastName} already has a reservation`
          });
        }

        if (friend.paymentStatus !== 'paid') {
          return res.status(400).json({
            success: false,
            message: `${friend.firstName} ${friend.lastName} has not completed payment`
          });
        }
      }

      roommateIds = friendStudents.map(f => f._id);
    }

    // 7. Get available bunk for primary student
    const bunk = await Bunk.findOne({
      room: room._id,
      status: 'available',
      isActive: true
    });

    if (!bunk) {
      return res.status(404).json({
        success: false,
        message: 'No available bunks in this room'
      });
    }

    // 8. Reserve bunk for primary student
    bunk.status = 'reserved';
    bunk.occupiedByStudent = student._id;
    bunk.reservedUntil = addHours(new Date(), config.RESERVATION_EXPIRY_HOURS);
    await bunk.save();

    // 9. Update primary student
    student.assignedHostel = room.hostel._id;
    student.assignedRoom = room._id;
    student.assignedBunk = bunk._id;
    student.reservationStatus = 'confirmed';
    student.reservedAt = new Date();
    student.reservationExpiresAt = bunk.reservedUntil;
    student.roommates = roommateIds;
    await student.save();

    // Update room occupancy
    room.currentOccupants += 1;

    let roommateDetails = [];

    // 10. Handle group reservation - assign bunks to friends
    if (isGroupReservation && roommateIds.length > 0) {
      for (const roommateId of roommateIds) {
        const roommateBunk = await Bunk.findOne({
          room: room._id,
          status: 'available',
          isActive: true
        });

        if (!roommateBunk) {
          // Rollback primary student's reservation
          bunk.status = 'available';
          bunk.occupiedByStudent = null;
          bunk.reservedUntil = null;
          await bunk.save();
          
          student.assignedHostel = null;
          student.assignedRoom = null;
          student.assignedBunk = null;
          student.reservationStatus = 'none';
          student.reservationExpiresAt = null;
          student.roommates = [];
          await student.save();

          room.currentOccupants -= 1;
          
          return res.status(400).json({
            success: false,
            message: 'Not enough available bunks for group reservation'
          });
        }

        // Reserve bunk for roommate
        roommateBunk.status = 'reserved';
        roommateBunk.occupiedByStudent = roommateId;
        roommateBunk.reservedUntil = bunk.reservedUntil;
        await roommateBunk.save();

        // Update roommate student record
        const roommateStudent = await Student.findById(roommateId);
        roommateStudent.assignedHostel = room.hostel._id;
        roommateStudent.assignedRoom = room._id;
        roommateStudent.assignedBunk = roommateBunk._id;
        roommateStudent.reservationStatus = 'confirmed';
        roommateStudent.reservedAt = new Date();
        roommateStudent.reservationExpiresAt = bunk.reservedUntil;
        roommateStudent.roommates = [student._id, ...roommateIds.filter(id => id.toString() !== roommateId.toString())];
        await roommateStudent.save();

        roommateDetails.push({
          id: roommateStudent._id,
          matricNo: roommateStudent.matricNo,
          name: `${roommateStudent.firstName} ${roommateStudent.lastName}`,
          bunk: roommateBunk.bunkNumber
        });

        room.currentOccupants += 1;

        console.log(`✅ Reserved bunk ${roommateBunk.bunkNumber} for ${roommateStudent.firstName}`);
      }
    }

    await room.updateStatus();

    // Clear cache
    cacheService.del(cacheService.cacheKeys.availableRooms(student.level));

    console.log('✅ Reservation created successfully');

    const responseData = {
      student: student._id,
      room: {
        id: room._id,
        number: room.roomNumber,
        floor: room.floor
      },
      hostel: {
        id: room.hostel._id,
        name: room.hostel.name
      },
      bunk: {
        id: bunk._id,
        number: bunk.bunkNumber
      },
      status: 'confirmed',
      reservedAt: new Date(),
      expiresAt: bunk.reservedUntil,
      isGroupReservation: isGroupReservation || false,
      groupMembers: roommateDetails
    };

    res.status(201).json({
      success: true,
      message: isGroupReservation 
        ? `Group reservation successful! Reserved ${roommateDetails.length + 1} bunks.`
        : 'Reservation created successfully',
      data: responseData
    });

  } catch (error) {
    console.error('❌ Reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating reservation',
      error: error.message
    });
  }
};
