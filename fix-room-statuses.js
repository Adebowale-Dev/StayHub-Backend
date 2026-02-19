require('dotenv').config();
const mongoose = require('mongoose');

const Room = require('./src/models/Room');
const Bunk = require('./src/models/Bunk');

async function fixRoomStatuses() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get first 20 rooms to check
    const rooms = await Room.find().limit(20).lean();
    
    console.log('🔍 Checking Room Status Issues...\n');
    
    let fixedCount = 0;
    let issuesFound = 0;
    
    for (const room of rooms) {
      const bunks = await Bunk.find({ room: room._id }).lean();
      
      const availableBunks = bunks.filter(b => b.status === 'available').length;
      const occupiedBunks = bunks.filter(b => b.status === 'occupied').length;
      const reservedBunks = bunks.filter(b => b.status === 'reserved').length;
      
      // Room shows as full but has available bunks
      if (room.status === 'full' && availableBunks > 0) {
        issuesFound++;
        console.log(`🚨 ISSUE FOUND: Room ${room.roomNumber}`);
        console.log(`   Status: ${room.status} (WRONG)`);
        console.log(`   Available Bunks: ${availableBunks}`);
        console.log(`   Occupied: ${occupiedBunks}, Reserved: ${reservedBunks}`);
        console.log(`   Fixing status...`);
        
        // Fix the room status
        const correctStatus = occupiedBunks + reservedBunks === 0 ? 'available' : 'partially_occupied';
        await Room.findByIdAndUpdate(room._id, { 
          status: correctStatus,
          currentOccupants: occupiedBunks 
        });
        
        fixedCount++;
        console.log(`   ✅ Fixed to: ${correctStatus}\n`);
      }
    }
    
    if (issuesFound === 0) {
      console.log('✅ No issues found in first 20 rooms!\n');
    } else {
      console.log(`\n📊 Summary:`);
      console.log(`   Issues Found: ${issuesFound}`);
      console.log(`   Fixed: ${fixedCount}\n`);
    }
    
    console.log('💡 Note: The API now calculates real-time availability from bunks,');
    console.log('   so room.status field is no longer used for filtering.\n');

    await mongoose.disconnect();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixRoomStatuses();
