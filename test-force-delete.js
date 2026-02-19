const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testForceDelete() {
  try {
    console.log('Step 1: Logging in as admin...');
    
    // Login first
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      identifier: 'YOUR_ADMIN_EMAIL',  // Replace with your admin email
      password: 'YOUR_ADMIN_PASSWORD'   // Replace with your admin password
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful, got token');
    
    const studentId = '692dba02b23f3f608d99ef08';  // The student you're trying to delete
    
    console.log(`\nStep 2: Force deleting student ${studentId}...`);
    console.log('URL:', `${BASE_URL}/admin/students/${studentId}/force-delete`);
    
    const deleteResponse = await axios.post(
      `${BASE_URL}/admin/students/${studentId}/force-delete`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        timeout: 30000  // 30 second timeout
      }
    );
    
    console.log('✅ Delete successful!');
    console.log('Response:', deleteResponse.data);
    
  } catch (error) {
    console.error('❌ Error occurred:');
    if (error.code === 'ECONNABORTED') {
      console.error('Request timed out after 30 seconds');
    } else if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testForceDelete();
