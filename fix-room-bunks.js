require('dotenv').config();
const mongoose = require('mongoose');
const Bunk = require('./src/models/Bunk');
const Room = require('./src/models/Room');
async function fixRoomBunks() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        const roomId = '692db4bfb23f3f608d99ed88';
        const room = await Room.findById(roomId);
        console.log('📦 Room Details:');
        console.log(`   Room Number: ${room.roomNumber}`);
        console.log(`   Capacity: ${room.capacity}`);
        console.log('');
        const existingBunks = await Bunk.find({ room: roomId });
        console.log(`🛏️  Existing Bunks: ${existingBunks.length}`);
        existingBunks.forEach(bunk => {
            console.log(`   - ${bunk.bunkNumber}: ${bunk.status}`);
        });
        console.log('');
        const missingBunks = room.capacity - existingBunks.length;
        if (missingBunks > 0) {
            console.log(`⚠️  Missing ${missingBunks} bunks!\n`);
            console.log('Creating missing bunks...');
            const bunkNumbers = existingBunks.map(b => {
                const num = parseInt(b.bunkNumber.replace(/\D/g, ''));
                return isNaN(num) ? 0 : num;
            });
            let nextBunkNum = Math.max(...bunkNumbers, 0) + 1;
            for (let i = 0; i < missingBunks; i++) {
                const newBunk = await Bunk.create({
                    bunkNumber: `B${nextBunkNum}`,
                    room: roomId,
                    status: 'available',
                    isActive: true,
                });
                console.log(`   ✅ Created bunk: ${newBunk.bunkNumber}`);
                nextBunkNum++;
            }
            console.log('\n✅ All missing bunks created!');
        }
        else {
            console.log('✅ Room has correct number of bunks!');
        }
        await mongoose.disconnect();
    }
    catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}
fixRoomBunks();
