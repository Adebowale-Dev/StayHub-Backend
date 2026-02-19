require('dotenv').config();
const mongoose = require('mongoose');

const Bunk = require('./src/models/Bunk');
const Room = require('./src/models/Room');
const Hostel = require('./src/models/Hostel');

async function checkRoomBunksMismatch() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all rooms
    const rooms = await Room.find().lean();
    
    console.log(`📊 Checking ${rooms.length} rooms for bunk mismatches...\n`);

    const mismatches = [];

    for (const room of rooms) {
      const bunks = await Bunk.find({ room: room._id }).lean();
      
      if (bunks.length !== room.capacity) {
        mismatches.push({
          roomId: room._id,
          roomNumber: room.roomNumber,
          capacity: room.capacity,
          actualBunks: bunks.length,
          missing: room.capacity - bunks.length,
        });
      }
    }

    if (mismatches.length === 0) {
      console.log('✅ All rooms have correct number of bunks!');
    } else {
      console.log(`⚠️  Found ${mismatches.length} rooms with mismatched bunks:\n`);
      
      mismatches.forEach((m, i) => {
        console.log(`${i + 1}. Room ${m.roomNumber} (ID: ${m.roomId})`);
        console.log(`   Capacity: ${m.capacity}`);
        console.log(`   Actual Bunks: ${m.actualBunks}`);
        console.log(`   Missing: ${m.missing} bunks`);
        console.log('');
      });

      console.log('\n💡 Recommendation:');
      console.log('   These rooms need bunks to be created to match their capacity.');
      console.log('   Room capacity should equal the number of bunks.');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRoomBunksMismatch();
