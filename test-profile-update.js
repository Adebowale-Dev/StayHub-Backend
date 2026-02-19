/**
 * Test script to verify profile update endpoint
 * 
 * Usage:
 * 1. Login to get a token
 * 2. Replace YOUR_TOKEN_HERE with actual token
 * 3. Run: node test-profile-update.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TOKEN = 'YOUR_TOKEN_HERE'; // Replace with actual token after login

async function testProfileUpdate() {
  try {
    console.log('Testing Profile Update Endpoint...\n');

    // Test 1: Update profile
    console.log('1. Updating profile...');
    const updateResponse = await axios.put(
      `${BASE_URL}/api/auth/profile`,
      {
        phoneNumber: '08012345678',
        address: 'Test Address 123',
        dateOfBirth: '2000-01-15',
        emergencyContact: '08098765432'
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Update Response Status:', updateResponse.status);
    console.log('Update Response Data:', JSON.stringify(updateResponse.data, null, 2));

    // Test 2: Get profile to verify update
    console.log('\n2. Fetching profile to verify update...');
    const getResponse = await axios.get(
      `${BASE_URL}/api/auth/profile`,
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`
        }
      }
    );

    console.log('Get Response Status:', getResponse.status);
    console.log('Get Response Data:', JSON.stringify(getResponse.data, null, 2));

    // Verify data matches
    const user = getResponse.data.user;
    console.log('\n3. Verification:');
    console.log('Phone Number:', user.phoneNumber === '08012345678' ? '✅ MATCH' : '❌ MISMATCH');
    console.log('Address:', user.address === 'Test Address 123' ? '✅ MATCH' : '❌ MISMATCH');
    console.log('Emergency Contact:', user.emergencyContact === '08098765432' ? '✅ MATCH' : '❌ MISMATCH');

  } catch (error) {
    console.error('\n❌ ERROR:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Run test
if (TOKEN === 'YOUR_TOKEN_HERE') {
  console.log('⚠️  Please replace YOUR_TOKEN_HERE with an actual JWT token');
  console.log('\nTo get a token:');
  console.log('1. Login via POST http://localhost:3000/api/auth/login');
  console.log('2. Copy the token from the response');
  console.log('3. Replace YOUR_TOKEN_HERE in this file');
} else {
  testProfileUpdate();
}
