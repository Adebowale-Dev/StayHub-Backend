require('dotenv').config();
const mongoose = require('mongoose');

const Bunk = require('./src/models/Bunk');
const Room = require('./src/models/Room');

async function fixAllRoomBunks() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all rooms
    const rooms = await Room.find();
    console.log(`📊 Checking ${rooms.length} rooms...\n`);

    let fixedCount = 0;
    let totalBunksCreated = 0;

    for (const room of rooms) {
      const existingBunks = await Bunk.find({ room: room._id });
      const missingBunks = room.capacity - existingBunks.length;
      
      if (missingBunks > 0) {
        console.log(`🔧 Room ${room.roomNumber} (${room._id})`);
        console.log(`   Capacity: ${room.capacity}, Existing: ${existingBunks.length}, Missing: ${missingBunks}`);
        
        // Find the highest bunk number
        const bunkNumbers = existingBunks.map(b => {
          const num = parseInt(b.bunkNumber.replace(/\D/g, ''));
          return isNaN(num) ? 0 : num;
        });
        
        let nextBunkNum = Math.max(...bunkNumbers, 0) + 1;
        
        for (let i = 0; i < missingBunks; i++) {
          await Bunk.create({
            bunkNumber: `B${nextBunkNum}`,
            room: room._id,
            status: 'available',
            isActive: true,
          });
          
          nextBunkNum++;
          totalBunksCreated++;
        }
        
        console.log(`   ✅ Created ${missingBunks} bunks\n`);
        fixedCount++;
      }
    }

    console.log('\n═══════════════════════════════════════');
    console.log(`✅ Fixed ${fixedCount} rooms`);
    console.log(`✅ Created ${totalBunksCreated} bunks`);
    console.log('═══════════════════════════════════════');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixAllRoomBunks();
