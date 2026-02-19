require('dotenv').config();
const mongoose = require('mongoose');

const Bunk = require('./src/models/Bunk');
const Room = require('./src/models/Room');
const Student = require('./src/models/Student');

async function checkBunks() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const roomId = '692db4bfb23f3f608d99ed88';
    
    // Get room details
    const room = await Room.findById(roomId).lean();
    console.log('📦 Room Details:');
    console.log(`   Room Number: ${room?.roomNumber}`);
    console.log(`   Capacity: ${room?.capacity}`);
    console.log(`   Status: ${room?.status}`);
    console.log('');

    // Get all bunks for this room
    const bunks = await Bunk.find({ room: roomId })
      .populate('occupiedByStudent', 'firstName lastName matricNo')
      .lean();

    console.log(`🛏️  Total Bunks: ${bunks.length}\n`);

    bunks.forEach((bunk, index) => {
      console.log(`Bunk ${index + 1}:`);
      console.log(`   Bunk Number: ${bunk.bunkNumber}`);
      console.log(`   Status: ${bunk.status}`);
      console.log(`   isActive: ${bunk.isActive}`);
      if (bunk.occupiedByStudent) {
        console.log(`   Student: ${bunk.occupiedByStudent.firstName} ${bunk.occupiedByStudent.lastName} (${bunk.occupiedByStudent.matricNo})`);
      }
      console.log('');
    });

    // Summary
    const available = bunks.filter(b => b.status === 'available').length;
    const occupied = bunks.filter(b => b.status === 'occupied').length;
    const reserved = bunks.filter(b => b.status === 'reserved').length;

    console.log('📊 Summary:');
    console.log(`   Available: ${available}`);
    console.log(`   Occupied: ${occupied}`);
    console.log(`   Reserved (not occupied): ${reserved}`);
    console.log(`   Total: ${bunks.length}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkBunks();
