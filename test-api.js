require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
let adminToken = '';
let studentToken = '';

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(name, method, url, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    log('green', `✓ ${name}: SUCCESS`);
    return response.data;
  } catch (error) {
    log('red', `✗ ${name}: FAILED`);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Message:', error.response.data.message || error.response.data);
    } else {
      console.log('   Error:', error.message);
    }
    return null;
  }
}

async function runTests() {
  log('cyan', '\n╔════════════════════════════════════════════════╗');
  log('cyan', '║  StayHub API Testing Suite                    ║');
  log('cyan', '╚════════════════════════════════════════════════╝\n');

  // Test 1: Health Check
  log('blue', '\n--- Health Check ---');
  await testEndpoint('Health Check', 'GET', '/health');

  // Test 2: Admin Login
  log('blue', '\n--- Authentication Tests ---');
  const adminLogin = await testEndpoint(
    'Admin Login',
    'POST',
    '/api/auth/login',
    {
      identifier: 'adebowale235@gmail.com',
      password: 'Adebowale2001',
    }
  );

  if (adminLogin && adminLogin.token) {
    adminToken = adminLogin.token;
    log('yellow', `   Admin Token: ${adminToken.substring(0, 20)}...`);
  }

  // Test 3: Student Login
  const studentLogin = await testEndpoint(
    'Student Login',
    'POST',
    '/api/auth/login',
    {
      identifier: 'BU22CSC1005',
      password: '1234',
    }
  );

  if (studentLogin && studentLogin.token) {
    studentToken = studentLogin.token;
    log('yellow', `   Student Token: ${studentToken.substring(0, 20)}...`);
  }

  // Test 4: Get Profile (Admin)
  if (adminToken) {
    await testEndpoint('Get Admin Profile', 'GET', '/api/auth/profile', null, adminToken);
  }

  // Test 5: Get Profile (Student)
  if (studentToken) {
    await testEndpoint('Get Student Profile', 'GET', '/api/auth/profile', null, studentToken);
  }

  // Test 6: Admin - Get Colleges
  log('blue', '\n--- Admin Endpoints ---');
  if (adminToken) {
    await testEndpoint('Get All Colleges', 'GET', '/api/admin/colleges', null, adminToken);
    await testEndpoint('Get All Departments', 'GET', '/api/admin/departments', null, adminToken);
    await testEndpoint('Get All Students', 'GET', '/api/admin/students', null, adminToken);
    await testEndpoint('Get Dashboard Stats', 'GET', '/api/admin/dashboard', null, adminToken);
  }

  // Test 7: Student - Get Available Hostels
  log('blue', '\n--- Student Endpoints ---');
  if (studentToken) {
    await testEndpoint('Get Available Hostels', 'GET', '/api/student/hostels', null, studentToken);
  }

  // Test 8: Payment - Get Amount
  log('blue', '\n--- Payment Endpoints ---');
  if (adminToken) {
    await testEndpoint('Get Payment Amount', 'GET', '/api/payments/amount', null, adminToken);
  }

  log('cyan', '\n╔════════════════════════════════════════════════╗');
  log('cyan', '║  Test Suite Completed!                         ║');
  log('cyan', '╚════════════════════════════════════════════════╝\n');
}

// Run tests
runTests().catch(console.error);
