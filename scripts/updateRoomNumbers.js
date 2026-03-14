const mongoose = require('mongoose');
const Room = require('../src/models/Room');
const Hostel = require('../src/models/Hostel');
require('dotenv').config();
const updateRoomNumbers = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database');
        const hostelName = process.argv[2] || 'John Hostel';
        const hostel = await Hostel.findOne({ name: hostelName });
        if (!hostel) {
            console.log(`❌ Hostel "${hostelName}" not found`);
            console.log('Available hostels:');
            const allHostels = await Hostel.find({}, 'name');
            allHostels.forEach(h => console.log(`  - ${h.name}`));
            return;
        }
        console.log(`📍 Found hostel: ${hostel.name} (${hostel._id})`);
        const rooms = await Room.find({ hostel: hostel._id })
            .sort({ floor: 1, roomNumber: 1 });
        console.log(`📦 Found ${rooms.length} rooms to update\n`);
        if (rooms.length === 0) {
            console.log('⚠️  No rooms to update');
            return;
        }
        const bulkOps = [];
        for (let i = 0; i < rooms.length; i++) {
            const newRoomNumber = (i + 1).toString().padStart(2, '0');
            const floor = Math.floor(i / 15) + 1;
            bulkOps.push({
                updateOne: {
                    filter: { _id: rooms[i]._id },
                    update: {
                        $set: {
                            roomNumber: newRoomNumber,
                            floor: floor
                        }
                    }
                }
            });
            console.log(`  ${rooms[i].roomNumber} → ${newRoomNumber} (Floor ${floor})`);
        }
        const result = await Room.bulkWrite(bulkOps);
        console.log('\n✅ All rooms updated successfully!');
        console.log(`📊 Updated ${result.modifiedCount} rooms`);
        console.log('\n📋 New numbering scheme:');
        console.log('  • Rooms 01-15: Floor 1');
        console.log('  • Rooms 16-30: Floor 2');
        console.log('  • Rooms 31-45: Floor 3');
        console.log('  • Rooms 46-60: Floor 4');
        console.log('  • And so on (15 rooms per floor)');
    }
    catch (error) {
        console.error('❌ Error updating room numbers:', error);
    }
    finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
    }
};
updateRoomNumbers();
