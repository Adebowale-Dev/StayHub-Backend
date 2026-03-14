require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./src/models/Student');
async function testStudentLogin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        const matricNo = 'BU22CSC1063';
        const testPassword = 'Maryalabi';
        console.log('\n🔍 Looking for student:', matricNo);
        const student = await Student.findOne({ matricNo: matricNo.toUpperCase() });
        if (!student) {
            console.log('❌ Student NOT found in database');
            return;
        }
        console.log('✅ Student found!');
        console.log('Name:', student.firstName, student.lastName);
        console.log('Email:', student.email);
        console.log('MatricNo:', student.matricNo);
        console.log('isActive:', student.isActive);
        console.log('Password hash:', student.password.substring(0, 20) + '...');
        console.log('\n🔐 Testing password:', testPassword);
        const isMatch = await student.comparePassword(testPassword);
        if (isMatch) {
            console.log('✅ Password is CORRECT!');
        }
        else {
            console.log('❌ Password is INCORRECT!');
            console.log('\n🔐 Testing with firstName only:', student.firstName);
            const isMatchFirstName = await student.comparePassword(student.firstName);
            if (isMatchFirstName) {
                console.log('✅ firstName works! Use:', student.firstName);
            }
            const capitalizedFirstName = student.firstName.charAt(0).toUpperCase() + student.firstName.slice(1).toLowerCase();
            console.log('\n🔐 Testing with capitalized firstName:', capitalizedFirstName);
            const isMatchCapitalized = await student.comparePassword(capitalizedFirstName);
            if (isMatchCapitalized) {
                console.log('✅ Capitalized firstName works! Use:', capitalizedFirstName);
            }
        }
    }
    catch (error) {
        console.error('❌ Error:', error.message);
    }
    finally {
        await mongoose.connection.close();
        console.log('\nDisconnected from MongoDB');
    }
}
testStudentLogin();
