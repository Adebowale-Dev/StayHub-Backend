# StayHub - Smart Hostel Management System

A comprehensive hostel management system for universities that manages hostels, rooms, bunks, student reservations, payments, and porters with role-based access control.

## 🚀 Features

### Core Features
- **Role-Based Access Control**: Admin, Porter, and Student roles with specific permissions
- **Level-Based Access**: Students can only access hostels for their academic level
- **Secure Authentication**: JWT-based authentication with first-login password change
- **Payment Integration**: Paystack payment gateway integration
- **Room Reservation System**: Temporary and confirmed reservations with expiry
- **Roommate Management**: Students can reserve rooms with friends
- **Real-time Notifications**: Email notifications for payments, reservations, and check-ins
- **Porter Management**: Application system with admin approval workflow

### Admin Capabilities
- Manage colleges and departments
- Bulk upload students via CSV
- Create and manage hostels, rooms, and bunks
- Approve porter applications and assign hostels
- Set payment amounts per semester
- View all payments and reservations
- Dashboard with comprehensive statistics

### Student Capabilities
- Login with matric number and password
- Make payments via Paystack
- View available hostels for their level
- Reserve rooms and select bunks
- Add roommates during reservation
- View reservation details and payment status
- Receive email confirmations

### Porter Capabilities
- Apply for porter position
- View assigned hostel and students
- Check in students with payment code verification
- Release expired reservations
- View daily reservation summaries
- Receive email notifications

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- Paystack account for payment processing
- Email service (Gmail or other SMTP)

## 🛠️ Installation

### 1. Clone the repository
```bash
cd StayHub
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your configurations:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/stayhub

# JWT Configuration
JWT_SECRET=your_secure_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# Paystack Configuration
PAYSTACK_SECRET_KEY=your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=your_paystack_public_key
PAYSTACK_CALLBACK_URL=http://localhost:5000/api/payments/callback

# Email Configuration (Gmail example)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
EMAIL_FROM=StayHub <noreply@stayhub.com>

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Reservation Configuration
RESERVATION_EXPIRY_HOURS=48
PAYMENT_CODE_LENGTH=6

# Admin Default Credentials
ADMIN_EMAIL=admin@stayhub.com
ADMIN_PASSWORD=Admin@123
```

### 4. Database Setup

Start MongoDB:
```bash
# For Windows
net start MongoDB

# For Mac/Linux
sudo systemctl start mongod
```

### 5. Start the Server

Development mode (with auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:5000`

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication

All protected routes require a Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### API Endpoints

#### Authentication (`/api/auth`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/login` | Public | Login for all roles |
| POST | `/change-password` | Private | Change password |
| POST | `/forgot-password` | Public | Request password reset |
| GET | `/profile` | Private | Get current user profile |
| POST | `/logout` | Private | Logout user |

**Login Request Body:**
```json
{
  "identifier": "admin@stayhub.com", // or matric number for students
  "password": "your_password"
}
```

**Login Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "user@email.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "student",
    "firstLogin": false
  }
}
```

#### Admin Routes (`/api/admin`)

**Colleges:**
- `POST /colleges` - Create college
- `GET /colleges` - Get all colleges
- `PUT /colleges/:id` - Update college
- `DELETE /colleges/:id` - Delete college

**Departments:**
- `POST /departments` - Create department
- `GET /departments` - Get all departments

**Students:**
- `POST /students` - Create single student
- `POST /students/bulk-upload` - Bulk upload students (CSV)
- `GET /students` - Get all students (with filters)

**Hostels:**
- `POST /hostels` - Create hostel
- `GET /hostels` - Get all hostels

**Rooms:**
- `POST /rooms` - Create room (auto-creates bunks)
- `GET /rooms` - Get all rooms

**Porters:**
- `POST /porters/approve` - Approve porter application
- `GET /porters` - Get all porters

**Dashboard:**
- `GET /dashboard` - Get admin dashboard statistics

**Example - Create Hostel:**
```json
{
  "name": "Unity Hall",
  "level": 200,
  "totalRooms": 50,
  "description": "Modern hostel for 200 level students"
}
```

#### Student Routes (`/api/student`)

- `GET /dashboard` - Get student dashboard
- `GET /hostels` - Get available hostels for student's level
- `GET /hostels/:hostelId/rooms` - Get available rooms in hostel
- `GET /rooms/:roomId/bunks` - Get available bunks in room
- `POST /reserve` - Reserve a room (requires payment)
- `GET /reservation` - Get current reservation details

**Example - Reserve Room:**
```json
{
  "roomId": "room_id_here",
  "bunkId": "bunk_id_here",
  "roommates": ["student_id_1", "student_id_2"]
}
```

#### Porter Routes (`/api/porter`)

- `POST /apply` - Submit porter application (Public)
- `GET /dashboard` - Get porter dashboard
- `GET /students` - Get students in assigned hostel
- `GET /rooms` - Get rooms in assigned hostel
- `POST /checkin/:studentId` - Check in a student
- `POST /release-expired` - Release expired reservations

**Example - Check in Student:**
```json
{
  "paymentCode": "123456"
}
```

#### Payment Routes (`/api/payments`)

**Student:**
- `POST /initialize` - Initialize payment
- `GET /status` - Get payment status
- `GET /amount` - Get current payment amount

**Admin:**
- `POST /set-amount` - Set payment amount
- `GET /` - Get all payments
- `GET /stats` - Get payment statistics

**Public:**
- `GET /verify/:reference` - Verify payment (Paystack callback)

**Example - Set Payment Amount:**
```json
{
  "amount": 50000,
  "semester": "First",
  "academicYear": "2023/2024"
}
```

## 🔐 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevents brute force attacks
- **Helmet**: Security headers
- **CORS**: Configurable cross-origin requests
- **Input Validation**: Express-validator for request validation
- **Role-Based Access**: Middleware-enforced permissions

## 📧 Email Notifications

The system sends automated emails for:
- Payment confirmation with 6-digit code
- Reservation confirmation
- Roommate notifications
- Porter application status
- Password reset
- Daily reservation summaries for porters

## 💾 Database Schema

### Main Collections
- **Admin**: System administrators
- **College**: University colleges
- **Department**: Academic departments
- **Student**: Student accounts with reservations
- **Hostel**: Hostel buildings
- **Room**: Individual rooms
- **Bunk**: Bed spaces in rooms
- **Porter**: Hostel porters
- **Payment**: Payment transactions

### Relationships
- College → Departments (One-to-Many)
- Department → Students (One-to-Many)
- Hostel → Rooms (One-to-Many)
- Room → Bunks (One-to-Many)
- Room → Students (One-to-Many)
- Porter → Hostel (Many-to-One)

## 🔄 Workflows

### Student Registration & Reservation Flow
1. Admin creates student account (default password: first name)
2. Student logs in and changes password
3. Student makes payment via Paystack
4. System generates 6-digit payment code
5. Student receives email confirmation
6. Student browses available hostels for their level
7. Student selects room and bunk
8. Student can add roommates (optional)
9. System creates temporary reservation
10. Porter verifies payment code and checks in student
11. Reservation becomes permanent

### Porter Application Flow
1. Applicant submits porter application
2. System sends confirmation email
3. Admin receives notification
4. Admin reviews and approves application
5. Admin assigns hostel to porter
6. Porter receives welcome email with credentials
7. Porter logs in and changes password
8. Porter manages assigned hostel

## 📊 CSV Bulk Upload Format

For bulk student upload, use this CSV format:

```csv
firstName,lastName,matricNo,email,level,college,department
John,Doe,CSC/2023/001,john.doe@example.com,100,college_id_here,department_id_here
Jane,Smith,CSC/2023/002,jane.smith@example.com,100,college_id_here,department_id_here
```

## 🧪 Testing

### Manual Testing
Use tools like Postman or Thunder Client:
1. Import the API endpoints
2. Test authentication flow
3. Test role-based access
4. Verify payment integration
5. Test reservation workflow

### Sample Test Account
```
Admin:
Email: admin@stayhub.com
Password: Admin@123

Student:
Matric No: CSC/2023/001
Password: John (first name)
```

## 🛡️ Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [] // Validation errors if any
}
```

## 📱 Frontend Integration

### Required Frontend Routes
- `/login` - Login page
- `/student/dashboard` - Student dashboard
- `/student/hostels` - Browse hostels
- `/student/reservations` - View reservations
- `/porter/dashboard` - Porter dashboard
- `/admin/dashboard` - Admin dashboard
- `/reset-password` - Password reset page

### Environment Variables for Frontend
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_PAYSTACK_PUBLIC_KEY=your_paystack_public_key
```

## 🚨 Common Issues & Solutions

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
Solution: Ensure MongoDB is running
```

### Email Not Sending
```
Solution: Check EMAIL_USER and EMAIL_PASSWORD in .env
For Gmail: Use App Password, not regular password
```

### Payment Verification Failed
```
Solution: Verify PAYSTACK_SECRET_KEY is correct
Check Paystack dashboard for transaction status
```

## 📈 Future Enhancements

- [ ] Multi-semester support
- [ ] Room maintenance scheduling
- [ ] Advanced analytics dashboard
- [ ] Mobile app integration
- [ ] QR code for check-ins
- [ ] Complaint management system
- [ ] Asset tracking
- [ ] Auto-update student levels

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 👥 Support

For support and queries:
- Email: support@stayhub.com
- Documentation: See API docs above
- Issues: Create an issue in the repository

## 🙏 Acknowledgments

- Express.js for the web framework
- Mongoose for MongoDB object modeling
- Paystack for payment processing
- Nodemailer for email functionality

---

**Built with ❤️ for University Hostel Management**
