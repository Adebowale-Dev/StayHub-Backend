require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/env');
const Room = require('../models/Room');
const Bunk = require('../models/Bunk');

async function cleanInactiveRooms() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all inactive rooms
    const inactiveRooms = await Room.find({ isActive: false });
    console.log(`\nFound ${inactiveRooms.length} inactive rooms`);

    if (inactiveRooms.length > 0) {
      console.log('\nInactive rooms:');
      inactiveRooms.forEach(room => {
        console.log(`  - Room ${room.roomNumber} (ID: ${room._id})`);
      });

      // Delete bunks associated with inactive rooms
      const roomIds = inactiveRooms.map(r => r._id);
      const deletedBunks = await Bunk.deleteMany({ room: { $in: roomIds } });
      console.log(`\nDeleted ${deletedBunks.deletedCount} bunks`);

      // Delete inactive rooms
      const result = await Room.deleteMany({ isActive: false });
      console.log(`Deleted ${result.deletedCount} inactive rooms`);
    }

    console.log('\n✅ Cleanup completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanInactiveRooms();
