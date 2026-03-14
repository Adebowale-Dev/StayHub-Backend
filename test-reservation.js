const axios = require('axios');
const BASE_URL = 'http://localhost:5000';
const ROOM_ID = '6925e49326cce7bf7d359727';
const TOKEN = 'YOUR_STUDENT_JWT_TOKEN_HERE';
async function testReservation() {
    try {
        console.log('Testing reservation endpoint...\n');
        const response = await axios.post(`${BASE_URL}/api/student/reserve`, {
            roomId: ROOM_ID
        }, {
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ SUCCESS!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
    }
    catch (error) {
        console.log('❌ ERROR!');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Error:', JSON.stringify(error.response.data, null, 2));
        }
        else {
            console.log('Error:', error.message);
        }
    }
}
testReservation();
