require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

// CONFIGURATION - Update these values
const TEST_STUDENT = {
  email: 'adebowale@gmail.com',  // Change to your test student email
  password: 'Mary'  // Change to your test student password
};

const TEST_PAYMENT_CODE = 'ABC123';  // Change to actual payment code from database

async function testPaymentVerification() {
  console.log('🧪 Testing Payment Verification Endpoint\n');
  console.log('=' .repeat(60));

  try {
    // Step 1: Login as student
    console.log('\n📝 Step 1: Logging in as student...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: TEST_STUDENT.email,
      password: TEST_STUDENT.password,
      userType: 'student'
    });

    if (!loginResponse.data.success) {
      throw new Error('Login failed: ' + loginResponse.data.message);
    }

    const token = loginResponse.data.token;
    console.log('✅ Login successful');
    console.log('   Token:', token.substring(0, 20) + '...');
    console.log('   Student:', loginResponse.data.data.user.firstName, loginResponse.data.data.user.lastName);

    // Step 2: Test payment verification
    console.log('\n🔍 Step 2: Verifying payment code...');
    console.log('   Payment Code:', TEST_PAYMENT_CODE);

    try {
      const verifyResponse = await axios.post(
        `${BASE_URL}/api/student/payment/verify-code`,
        { paymentCode: TEST_PAYMENT_CODE },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('\n✅ Verification successful!');
      console.log('Response:', JSON.stringify(verifyResponse.data, null, 2));

    } catch (verifyError) {
      if (verifyError.response) {
        console.log('\n❌ Verification failed with status:', verifyError.response.status);
        console.log('Response data:', JSON.stringify(verifyError.response.data, null, 2));
        
        // Additional debugging
        console.log('\n🔍 Debug Info:');
        console.log('   Status Code:', verifyError.response.status);
        console.log('   Has Message:', !!verifyError.response.data.message);
        console.log('   Message:', verifyError.response.data.message || 'NO MESSAGE');
        console.log('   Success:', verifyError.response.data.success);
      } else if (verifyError.request) {
        console.log('\n❌ No response received from server');
        console.log('Request was made but no response received');
      } else {
        console.log('\n❌ Error setting up request:', verifyError.message);
      }
      throw verifyError;
    }

    // Step 3: Test with invalid code
    console.log('\n🧪 Step 3: Testing with invalid code...');
    try {
      await axios.post(
        `${BASE_URL}/api/student/payment/verify-code`,
        { paymentCode: 'INVALID' },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      if (error.response?.status === 404 || error.response?.status === 400) {
        console.log('✅ Invalid code properly rejected:', error.response.data.message);
      }
    }

    // Step 4: Test with missing code
    console.log('\n🧪 Step 4: Testing with missing code...');
    try {
      await axios.post(
        `${BASE_URL}/api/student/payment/verify-code`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Missing code properly rejected:', error.response.data.message);
      }
    }

    // Step 5: Test with wrong length code
    console.log('\n🧪 Step 5: Testing with wrong length code...');
    try {
      await axios.post(
        `${BASE_URL}/api/student/payment/verify-code`,
        { paymentCode: 'ABC' },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Wrong length code properly rejected:', error.response.data.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed!');

  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ Test suite failed');
    if (error.response) {
      console.log('Server returned:', error.response.status, error.response.statusText);
      console.log('Error data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
    process.exit(1);
  }
}

// Additional helper: Get payment info from database
async function getPaymentInfo() {
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGODB_URI);
  
  const Payment = require('./src/models/Payment');
  const Student = require('./src/models/Student');
  
  console.log('\n📋 Recent Payments:\n');
  const payments = await Payment.find()
    .populate('student', 'firstName lastName email matricNo')
    .sort({ createdAt: -1 })
    .limit(5);
  
  payments.forEach(payment => {
    console.log(`Code: ${payment.paymentCode} | Status: ${payment.status} | Student: ${payment.student?.firstName} ${payment.student?.lastName}`);
  });
  
  await mongoose.disconnect();
}

// Run based on argument
const arg = process.argv[2];

if (arg === '--list-payments') {
  getPaymentInfo();
} else {
  testPaymentVerification();
}
