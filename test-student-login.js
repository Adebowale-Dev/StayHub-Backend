const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testLogin() {
  try {
    console.log('Testing student login with BU22CSC1005...\n');

    // Test 1: Try with password "1234" (current default)
    console.log('Test 1: Password "1234"');
    try {
      const response1 = await axios.post(`${API_URL}/auth/login`, {
        identifier: 'BU22CSC1005',
        password: '1234'
      });
      console.log('✓ Success with "1234"');
      console.log('User:', response1.data.user);
      console.log('Token:', response1.data.token.substring(0, 20) + '...');
    } catch (err1) {
      console.log('✗ Failed with "1234":', err1.response?.data?.message || err1.message);
    }

    console.log('\n---\n');

    // Test 2: Try with password "Muhammed" (first name)
    console.log('Test 2: Password "Muhammed"');
    try {
      const response2 = await axios.post(`${API_URL}/auth/login`, {
        identifier: 'BU22CSC1005',
        password: 'Muhammed'
      });
      console.log('✓ Success with "Muhammed"');
      console.log('User:', response2.data.user);
      console.log('Token:', response2.data.token.substring(0, 20) + '...');
    } catch (err2) {
      console.log('✗ Failed with "Muhammed":', err2.response?.data?.message || err2.message);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLogin();
