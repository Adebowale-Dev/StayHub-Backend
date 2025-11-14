const axios = require('axios');

async function quickTest() {
  try {
    // Login
    const login = await axios.post('http://localhost:5000/api/auth/login', {
      identifier: 'adebowale235@gmail.com',
      password: 'Adebowale2001'
    });
    
    const token = login.data.token;
    
    // Quick search
    const search = await axios.get('http://localhost:5000/api/admin/search?query=BU22CSC1005', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('\n=== SEARCH RESULTS ===');
    console.log('Query:', search.data.query);
    console.log('Total Results:', search.data.totalResults);
    console.log('\nStudents Found:', search.data.results.studentsCount);
    if (search.data.results.students.length > 0) {
      console.log('\nStudent Details:');
      const student = search.data.results.students[0];
      console.log('  Matric No:', student.matricNo);
      console.log('  Name:', `${student.firstName} ${student.lastName}`);
      console.log('  Email:', student.email);
      console.log('  Level:', student.level);
      console.log('  College:', student.college?.name);
      console.log('  Department:', student.department?.name);
      console.log('  Payment Status:', student.paymentStatus);
      console.log('  Reservation Status:', student.reservationStatus);
    }
    
    console.log('\n✓ Search endpoint working correctly!');
    
  } catch (error) {
    console.error('✗ Error:', error.response?.data || error.message);
  }
}

quickTest();
