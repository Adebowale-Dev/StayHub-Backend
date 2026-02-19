# StayHub - Database Schema & Backend Logic Documentation

## Table of Contents
1. [Database Models](#database-models)
2. [Backend API Endpoints](#backend-api-endpoints)
3. [Business Logic & Workflows](#business-logic--workflows)

---

## Database Models

### 1. Student Model
**Collection:** `students`

**Schema:**
```javascript
{
  // Personal Information
  firstName: String (required, trimmed),
  lastName: String (required, trimmed),
  matricNo: String (required, unique, uppercase, trimmed),
  email: String (required, unique, lowercase, trimmed),
  password: String (required, hashed with bcrypt),
  phoneNumber: String (trimmed),
  address: String (trimmed),
  dateOfBirth: Date,
  emergencyContact: String (trimmed),
  
  // Academic Information
  level: Number (required, enum: [100, 200, 300, 400, 500]),
  gender: String (required, enum: ['male', 'female'], lowercase),
  college: ObjectId (required, ref: 'College'),
  department: ObjectId (required, ref: 'Department'),
  
  // Accommodation Information
  assignedHostel: ObjectId (ref: 'Hostel'),
  assignedRoom: ObjectId (ref: 'Room'),
  assignedBunk: ObjectId (ref: 'Bunk'),
  roommates: [ObjectId] (ref: 'Student'),
  
  // Payment Information
  paymentStatus: String (enum: ['pending', 'paid', 'failed'], default: 'pending'),
  paymentReference: String,
  paymentCode: String (unique, sparse),
  
  // Reservation Information
  reservationStatus: String (enum: ['none', 'temporary', 'confirmed', 'checked_in', 'expired'], default: 'none'),
  reservationExpiresAt: Date,
  checkInDate: Date,
  reservedBy: ObjectId (ref: 'Student'),
  
  // System Fields
  firstLogin: Boolean (default: true),
  role: String (default: 'student', immutable),
  isActive: Boolean (default: true),
  lastLogin: Date,
  
  // Timestamps
  createdAt: Date (auto-generated),
  updatedAt: Date (auto-generated)
}
```

**Indexes:**
- `matricNo` (unique)
- `email` (unique)
- `level`
- `college`
- `department`
- `paymentStatus`
- `reservationStatus`
- `assignedHostel`
- `isActive`
- Compound: `{ level: 1, college: 1, isActive: 1 }`

**Methods:**
- `comparePassword(candidatePassword)` - Compares hashed passwords
- `toJSON()` - Removes password from JSON output

**Hooks:**
- Pre-save: Hashes password before saving if modified

---

### 2. Hostel Model
**Collection:** `hostels`

**Schema:**
```javascript
{
  name: String (required, trimmed),
  level: Number (required, enum: [100, 200, 300, 400, 500]),
  gender: String (required, enum: ['male', 'female', 'mixed'], lowercase),
  totalRooms: Number (required, min: 1),
  portersAssigned: [ObjectId] (ref: 'Porter'),
  isActive: Boolean (default: true),
  description: String (trimmed),
  
  // Timestamps
  createdAt: Date (auto-generated),
  updatedAt: Date (auto-generated)
}
```

**Virtual Fields:**
- `rooms` - Populated from Room collection
- `occupancyStats` - Calculates totalRooms and porterCount

---

### 3. Room Model
**Collection:** `rooms`

**Schema:**
```javascript
{
  roomNumber: String (required, trimmed),
  floor: Number (min: 0),
  capacity: Number (required, min: 2),
  currentOccupants: Number (default: 0, min: 0),
  level: Number (required, enum: [100, 200, 300, 400, 500]),
  hostel: ObjectId (required, ref: 'Hostel'),
  status: String (enum: ['available', 'partially_occupied', 'full', 'maintenance'], default: 'available'),
  isActive: Boolean (default: true),
  
  // Timestamps
  createdAt: Date (auto-generated),
  updatedAt: Date (auto-generated)
}
```

**Indexes:**
- Compound: `{ roomNumber: 1, hostel: 1 }` (unique)

**Virtual Fields:**
- `students` - Populated from Student collection
- `bunks` - Populated from Bunk collection
- `totalBunks` - Calculated as Math.floor(capacity / 2)
- `availableSpaces` - Calculated as capacity - currentOccupants

**Methods:**
- `updateStatus()` - Updates room status based on occupancy
  - 0 occupants → 'available'
  - < capacity → 'partially_occupied'
  - >= capacity → 'full'

---

### 4. Bunk Model
**Collection:** `bunks`

**Schema:**
```javascript
{
  bunkNumber: String (required, trimmed),
  room: ObjectId (required, ref: 'Room'),
  occupiedByStudent: ObjectId (ref: 'Student'),
  status: String (enum: ['available', 'reserved', 'occupied', 'maintenance'], default: 'available'),
  reservedUntil: Date,
  isActive: Boolean (default: true),
  
  // Timestamps
  createdAt: Date (auto-generated),
  updatedAt: Date (auto-generated)
}
```

**Indexes:**
- Compound: `{ bunkNumber: 1, room: 1 }` (unique)

**Methods:**
- `isReservationExpired()` - Checks if reservation has expired
- `releaseIfExpired()` - Releases bunk if reservation expired

---

### 5. Payment Model
**Collection:** `payments`

**Schema:**
```javascript
{
  student: ObjectId (required, ref: 'Student'),
  amount: Number (required, min: 0),
  paymentReference: String (required, unique),
  paymentCode: String (required, unique),
  status: String (enum: ['pending', 'completed', 'failed', 'cancelled'], default: 'pending'),
  paymentMethod: String (default: 'paystack'),
  datePaid: Date,
  paystackResponse: Mixed,
  semester: String (trimmed),
  academicYear: String (trimmed),
  notes: String (trimmed),
  
  // Timestamps
  createdAt: Date (auto-generated),
  updatedAt: Date (auto-generated)
}
```

**Indexes:**
- `paymentReference` (unique)
- `paymentCode` (unique)
- Compound: `{ student: 1, status: 1 }`

---

### 6. Admin Model
**Collection:** `admins`

**Schema:**
```javascript
{
  email: String (required, unique, lowercase, trimmed),
  password: String (required, hashed with bcrypt),
  firstName: String (required),
  lastName: String (required),
  role: String (default: 'admin', immutable),
  isActive: Boolean (default: true),
  lastLogin: Date,
  
  // Timestamps
  createdAt: Date (auto-generated),
  updatedAt: Date (auto-generated)
}
```

**Indexes:**
- `email` (unique)
- `isActive`

**Methods:**
- `comparePassword(candidatePassword)`
- `toJSON()` - Removes password

**Hooks:**
- Pre-save: Hashes password

---

### 7. Porter Model
**Collection:** `porters`

**Schema:**
```javascript
{
  firstName: String (required, trimmed),
  lastName: String (required, trimmed),
  email: String (required, unique, lowercase, trimmed),
  password: String (required, hashed with bcrypt),
  phoneNumber: String (trimmed),
  assignedHostel: ObjectId (ref: 'Hostel'),
  employeeId: String (unique, sparse),
  joinedDate: Date,
  status: String (enum: ['pending', 'approved', 'rejected', 'suspended', 'active'], default: 'pending'),
  shiftSchedule: String (trimmed),
  approved: Boolean (default: false),
  applicationDate: Date (default: Date.now),
  approvedDate: Date,
  approvedBy: ObjectId (ref: 'Admin'),
  firstLogin: Boolean (default: true),
  role: String (default: 'porter', immutable),
  isActive: Boolean (default: true),
  lastLogin: Date,
  
  // Timestamps
  createdAt: Date (auto-generated),
  updatedAt: Date (auto-generated)
}
```

**Indexes:**
- `email` (unique)
- `assignedHostel`
- `status`
- `approved`
- `isActive`

**Virtual Fields:**
- `name` - Concatenates firstName + lastName

**Methods:**
- `comparePassword(candidatePassword)`
- `toJSON()` - Removes password, adds name field

**Hooks:**
- Pre-save: Hashes password

---

### 8. College Model
**Collection:** `colleges`

**Schema:**
```javascript
{
  name: String (required, unique, trimmed),
  code: String (required, unique, uppercase, trimmed),
  description: String (trimmed),
  deanName: String (trimmed),
  deanEmail: String (lowercase, trimmed),
  isActive: Boolean (default: true),
  
  // Timestamps
  createdAt: Date (auto-generated),
  updatedAt: Date (auto-generated)
}
```

**Indexes:**
- `name` (unique)
- `code` (unique)

**Virtual Fields:**
- `departments` - Populated from Department collection

---

### 9. Department Model
**Collection:** `departments`

**Schema:**
```javascript
{
  name: String (required, trimmed),
  code: String (required, uppercase, trimmed),
  description: String (trimmed),
  hodName: String (trimmed),
  hodEmail: String (lowercase, trimmed),
  availableLevels: [Number] (enum: [100, 200, 300, 400, 500]),
  college: ObjectId (required, ref: 'College'),
  isActive: Boolean (default: true),
  
  // Timestamps
  createdAt: Date (auto-generated),
  updatedAt: Date (auto-generated)
}
```

**Indexes:**
- Compound: `{ code: 1, college: 1 }` (unique)

---

## Backend API Endpoints

### Admin Endpoints

#### College Management
- **POST** `/api/admin/colleges` - Create college
- **GET** `/api/admin/colleges` - Get all colleges
- **PUT** `/api/admin/colleges/:id` - Update college
- **DELETE** `/api/admin/colleges/:id` - Delete college

#### Department Management
- **POST** `/api/admin/departments` - Create department
- **GET** `/api/admin/departments` - Get all departments
- **PUT** `/api/admin/departments/:id` - Update department
- **DELETE** `/api/admin/departments/:id` - Delete department

#### Student Management
- **POST** `/api/admin/students` - Create student
- **POST** `/api/admin/students/bulk-upload` - Bulk upload students
- **GET** `/api/admin/students` - Get all students (with filters)
- **GET** `/api/admin/students/male` - Get male students
- **GET** `/api/admin/students/female` - Get female students
- **GET** `/api/admin/students/college/:collegeId` - Get students by college
- **GET** `/api/admin/students/department/:departmentId` - Get students by department
- **PUT** `/api/admin/students/:id` - Update student
- **DELETE** `/api/admin/students/:id` - Delete student
- **POST** `/api/admin/students/:id/reset-password` - Reset student password

#### Hostel Management
- **POST** `/api/admin/hostels` - Create hostel
- **GET** `/api/admin/hostels` - Get all hostels
- **PUT** `/api/admin/hostels/:id` - Update hostel
- **DELETE** `/api/admin/hostels/:id` - Delete hostel

#### Room Management
- **POST** `/api/admin/rooms` - Create room
- **GET** `/api/admin/rooms` - Get all rooms
- **PUT** `/api/admin/rooms/:id` - Update room
- **DELETE** `/api/admin/rooms/:id` - Delete room

#### Porter Management
- **POST** `/api/admin/porters` - Create porter
- **GET** `/api/admin/porters` - Get all porters
- **PUT** `/api/admin/porters/:id` - Update porter
- **DELETE** `/api/admin/porters/:id` - Delete porter
- **PUT** `/api/admin/porters/:id/approve` - Approve porter
- **PUT** `/api/admin/porters/:id/assign-hostel` - Assign hostel to porter

#### Statistics & Search
- **GET** `/api/admin/dashboard/stats` - Get dashboard statistics
- **GET** `/api/admin/statistics/colleges` - Get college statistics
- **GET** `/api/admin/search` - Search across students, hostels, rooms

---

### Student Endpoints

#### Hostel & Room Browsing
- **GET** `/api/student/hostels` - Get available hostels for student's level/gender
- **GET** `/api/student/hostels/:hostelId/rooms` - Get available rooms in hostel
  - Returns: rooms with `availableSpaces`, `currentOccupants`, `reservedSpaces`, `isAvailable`
- **GET** `/api/student/rooms/:roomId/bunks` - Get available bunks in room

#### Reservation
- **POST** `/api/student/reserve` - Reserve a room/bunk
- **POST** `/api/student/reservations` - Create reservation (frontend compatibility endpoint)
- **GET** `/api/student/reservation` - Get student's current reservation

#### Dashboard
- **GET** `/api/student/dashboard` - Get student dashboard data

---

### Porter Endpoints

#### Application
- **POST** `/api/porter/apply` - Apply as porter

#### Dashboard & Management
- **GET** `/api/porter/dashboard` - Get porter dashboard
- **GET** `/api/porter/students` - Get students in assigned hostel
- **POST** `/api/porter/students/:id/check-in` - Check in a student
- **GET** `/api/porter/rooms` - Get rooms in assigned hostel
- **POST** `/api/porter/reservations/release-expired` - Release expired reservations

---

### Payment Endpoints

#### Payment Initialization
- **POST** `/api/payment/initialize` - Initialize payment with Paystack
  - Generates 6-character payment code
  - Sends code via email
  - Returns Paystack authorization URL

#### Payment Verification
- **POST** `/api/payment/verify-code` - Verify payment using 6-character code
  - Validates code format and existence
  - Verifies with Paystack API
  - Updates student payment status
  - Accepts Paystack status: 'success', 'paid', 'completed'

---

## Business Logic & Workflows

### 1. Student Registration & Authentication
```
1. Admin creates student account
2. Student receives credentials
3. Student logs in (firstLogin = true)
4. Student must change password on first login
5. Student can access accommodation features
```

### 2. Payment Workflow (2-Step Verification)
```
Step 1: Initialize Payment
├─ Student clicks "Make Payment"
├─ Backend generates payment reference
├─ Backend generates 6-character code (e.g., "AB12CD")
├─ Payment record created with status='pending'
├─ Email sent with payment code
└─ Paystack authorization URL returned

Step 2: Complete Payment
├─ Student redirected to Paystack
├─ Student completes payment
├─ Student returns to app
├─ Student enters 6-character code
└─ Backend verifies:
    ├─ Code exists and belongs to student
    ├─ Calls Paystack API to verify transaction
    ├─ Status cleaning (handles quotes, whitespace)
    ├─ Accepts: 'success', 'paid', 'completed'
    ├─ Updates payment.status = 'completed'
    ├─ Updates student.paymentStatus = 'paid'
    └─ Returns success response
```

### 3. Room Reservation Workflow
```
1. Student must have paymentStatus = 'paid'
2. Student browses available hostels (filtered by level/gender)
3. Student views rooms with real-time availability:
   ├─ availableSpaces: bunks with status='available' and isActive=true
   ├─ currentOccupants: bunks with status='occupied'
   ├─ reservedSpaces: bunks with status='reserved'
   └─ isAvailable: true if availableSpaces > 0

4. Individual Reservation:
   ├─ Student selects room and bunk
   ├─ Backend validates availability
   ├─ Bunk status → 'reserved'
   ├─ Student.assignedBunk → bunk._id
   ├─ Student.assignedRoom → room._id
   ├─ Student.assignedHostel → hostel._id
   └─ Student.reservationStatus → 'temporary'

5. Group Reservation:
   ├─ Student provides roommates (by matricNo)
   ├─ Backend validates all friends exist
   ├─ Backend auto-assigns bunks to all members
   ├─ All bunks status → 'reserved'
   ├─ All students updated with assignments
   └─ Rollback if any step fails
```

### 4. Check-In Workflow
```
1. Porter scans student QR code or enters matric number
2. Backend validates:
   ├─ Student has paymentStatus = 'paid'
   ├─ Student has reservation (assignedBunk exists)
   └─ Bunk status is 'reserved' or 'available'

3. Check-in process:
   ├─ Bunk.status → 'occupied'
   ├─ Bunk.occupiedByStudent → student._id
   ├─ Student.reservationStatus → 'checked_in'
   ├─ Student.checkInDate → current date
   └─ Room.currentOccupants incremented

4. Room status updated automatically:
   ├─ Room.updateStatus() called
   └─ Status set based on occupancy ratio
```

### 5. Room Availability Calculation
```javascript
// In GET /api/student/hostels/:hostelId/rooms
const rooms = await Room.find({ hostel: hostelId })
  .populate('bunks')
  .lean();

const roomsWithAvailability = rooms.map(room => {
  // Only count truly available bunks
  const availableBunks = room.bunks?.filter(
    bunk => bunk.status === 'available' && bunk.isActive
  ).length || 0;
  
  const currentOccupants = room.bunks?.filter(
    bunk => bunk.status === 'occupied'
  ).length || 0;
  
  const reservedBunks = room.bunks?.filter(
    bunk => bunk.status === 'reserved'
  ).length || 0;
  
  return {
    ...room,
    availableSpaces: availableBunks,
    currentOccupants: currentOccupants,
    reservedSpaces: reservedBunks,
    isAvailable: availableBunks > 0
  };
});
```

### 6. Payment Status Validation (Enhanced)
```javascript
// Step 1: Raw API response logging
console.log('📦 Full Paystack response:', JSON.stringify(verification, null, 2));
console.log('📦 Raw status value:', verification.data?.status);

// Step 2: Status cleaning (handles edge cases)
let status = paystackData?.status;
if (typeof status === 'string') {
  // Remove quotes, whitespace, normalize case
  status = status.trim().replace(/^["']|["']$/g, '').toLowerCase();
}

// Step 3: Character code analysis (debugging)
console.log('📦 Status char codes:', [...status].map(c => c.charCodeAt(0)));

// Step 4: Validation with multiple accepted statuses
const validStatuses = ['success', 'paid', 'completed'];
const isPaymentSuccess = validStatuses.includes(status);

// Step 5: Update database if valid
if (isPaymentSuccess) {
  payment.status = 'completed';
  student.paymentStatus = 'paid';
  await payment.save();
  await student.save();
}
```

### 7. Bunk Count Validation
```
Problem: Rooms may have capacity=4 but only 2 bunks exist
Solution: Periodic script to create missing bunks

Script Logic:
├─ Query all rooms
├─ For each room:
│   ├─ Count existing bunks
│   ├─ Compare with room.capacity
│   └─ If mismatch:
│       ├─ Calculate missing bunks
│       ├─ Create new bunks (B3, B4, etc.)
│       └─ Set status='available', isActive=true
└─ Log results
```

---

## Key Business Rules

### Payment Rules
1. Students cannot reserve rooms without `paymentStatus = 'paid'`
2. Payment codes are 6 characters, unique per transaction
3. Payment verification accepts multiple Paystack statuses for flexibility
4. Payment records are immutable once `status = 'completed'`

### Reservation Rules
1. Students can only reserve in hostels matching their level and gender
2. Reserved bunks expire after configured time period
3. Group reservations are atomic (all succeed or all fail)
4. Students cannot have multiple active reservations

### Room & Bunk Rules
1. Room capacity must equal number of bunks
2. Bunk status progression: available → reserved → occupied
3. Room status auto-updates based on bunk occupancy
4. Inactive bunks/rooms excluded from availability calculations

### Authentication & Authorization
1. First-time users must change password
2. Role-based access control (admin, student, porter)
3. Students can only view/modify their own data
4. Porters can only access assigned hostel data
5. Admins have full system access

---

## Database Relationships

```
College (1) ──────── (Many) Department
   │
   └──────────────── (Many) Student

Department (1) ───── (Many) Student

Hostel (1) ────────── (Many) Room
   │                     │
   │                     └─── (Many) Bunk
   │                             │
   └── (Many) Porter             └─── (1) Student (occupiedByStudent)

Student ────────────── (1) Hostel (assignedHostel)
   │                   (1) Room (assignedRoom)
   │                   (1) Bunk (assignedBunk)
   │                   (Many) Student (roommates)
   └────────────────── (Many) Payment
```

---

## Indexes Summary

**Performance-Critical Indexes:**
- `Student.matricNo` (unique) - Login, search
- `Student.email` (unique) - Authentication
- `Payment.paymentCode` (unique) - Verification
- `Bunk.{ bunkNumber, room }` (compound unique) - Assignment
- `Room.{ roomNumber, hostel }` (compound unique) - Search

**Query Optimization Indexes:**
- `Student.{ level, college, isActive }` - Dashboard queries
- `Student.paymentStatus` - Payment filtering
- `Student.reservationStatus` - Reservation filtering
- `Porter.assignedHostel` - Hostel management

---

## Notes

### Recent Fixes & Enhancements
1. **Payment Verification** - Enhanced with status cleaning and multiple valid statuses
2. **Room Availability** - Fixed to use bunk.status instead of non-existent isOccupied/isReserved
3. **Bunk Creation** - Script to fix rooms with missing bunks
4. **Email Notifications** - Payment codes sent immediately after initialization
5. **Frontend Compatibility** - Added `/reservations` endpoint alias

### Future Considerations
- Implement reservation expiry cron job
- Add payment refund workflow
- Implement room transfer functionality
- Add accommodation history tracking
- Implement room maintenance scheduling

---

**Generated:** December 5, 2025  
**System:** StayHub Backend API  
**Database:** MongoDB with Mongoose ODM  
**Authentication:** JWT + bcrypt
