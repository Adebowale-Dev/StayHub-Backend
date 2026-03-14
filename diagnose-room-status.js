require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('./src/models/Room');
const Bunk = require('./src/models/Bunk');
async function diagnoseRoomIssue() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        const rooms = await Room.find().lean();
        console.log('🔍 Diagnosing Room Status Issues...\n');
        const issues = [];
        for (const room of rooms) {
            const bunks = await Bunk.find({ room: room._id }).lean();
            const availableBunks = bunks.filter(b => b.status === 'available').length;
            const occupiedBunks = bunks.filter(b => b.status === 'occupied').length;
            const reservedBunks = bunks.filter(b => b.status === 'reserved').length;
            let correctStatus = 'available';
            const totalUsed = occupiedBunks + reservedBunks;
            if (totalUsed === 0) {
                correctStatus = 'available';
            }
            else if (totalUsed < room.capacity) {
                correctStatus = 'partially_occupied';
            }
            else {
                correctStatus = 'full';
            }
            if (room.status !== correctStatus || availableBunks > 0) {
                issues.push({
                    roomNumber: room.roomNumber,
                    currentStatus: room.status,
                    correctStatus: correctStatus,
                    capacity: room.capacity,
                    totalBunks: bunks.length,
                    availableBunks: availableBunks,
                    occupiedBunks: occupiedBunks,
                    reservedBunks: reservedBunks,
                    currentOccupants: room.currentOccupants,
                    hasAvailableSpace: availableBunks > 0,
                });
            }
        }
        if (issues.length === 0) {
            console.log('✅ All rooms have correct status!\n');
        }
        else {
            console.log(`⚠️  Found ${issues.length} rooms with potential issues:\n`);
            issues.forEach((issue, index) => {
                console.log(`${index + 1}. Room ${issue.roomNumber}`);
                console.log(`   Current Status: ${issue.currentStatus}`);
                console.log(`   Correct Status: ${issue.correctStatus}`);
                console.log(`   Capacity: ${issue.capacity}`);
                console.log(`   Total Bunks: ${issue.totalBunks}`);
                console.log(`   Available: ${issue.availableBunks}`);
                console.log(`   Occupied: ${issue.occupiedBunks}`);
                console.log(`   Reserved: ${issue.reservedBunks}`);
                console.log(`   Has Available Space: ${issue.hasAvailableSpace ? '✅ YES' : '❌ NO'}`);
                console.log(`   ${issue.currentStatus === 'full' && issue.availableBunks > 0 ? '🚨 ISSUE: Status is "full" but has available bunks!' : ''}`);
                console.log('');
            });
            console.log('\n💡 Fix: The API now ignores room.status and calculates real-time availability from bunks.');
            console.log('   Mobile app should check: isAvailable field (based on availableSpaces > 0)\n');
        }
        await mongoose.disconnect();
    }
    catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}
diagnoseRoomIssue();
