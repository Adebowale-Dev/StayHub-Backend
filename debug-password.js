require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Student = require('./src/models/Student');

async function debugPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find the student
    const student = await Student.findOne({ matricNo: 'BU22CSC1005' }).select('+password');
    
    if (!student) {
      console.log('❌ Student not found');
      process.exit(1);
    }

    console.log('📝 Student:', student.firstName, student.lastName);
    console.log('🔐 Stored Password Hash:', student.password);
    console.log('');

    // Manually hash "1234" and compare
    console.log('🧪 Testing Manual Hash:');
    const testPassword = '1234';
    const manualMatch = await bcrypt.compare(testPassword, student.password);
    console.log(`   bcrypt.compare("1234", storedHash): ${manualMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
    
    // Test comparePassword method
    console.log('\n🧪 Testing Model Method:');
    const methodMatch = await student.comparePassword(testPassword);
    console.log(`   student.comparePassword("1234"): ${methodMatch ? '✅ MATCH' : '❌ NO MATCH'}`);

    // Create a new hash for "1234" and show it
    console.log('\n🔨 Creating Fresh Hash for "1234":');
    const salt = await bcrypt.genSalt(10);
    const freshHash = await bcrypt.hash('1234', salt);
    console.log('   New Hash:', freshHash);
    const freshMatch = await bcrypt.compare('1234', freshHash);
    console.log(`   Verification: ${freshMatch ? '✅ MATCH' : '❌ NO MATCH'}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

debugPassword();
