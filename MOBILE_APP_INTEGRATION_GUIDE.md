# StayHub Student Mobile App - Backend Integration Guide

## 📱 Overview
Yes, it's **100% possible** to create a mobile app for the student portal! This backend is perfectly suited for mobile app integration with full REST API support, JWT authentication, and comprehensive endpoints.

---

## 🔑 Essential Backend Information

### 1. Base URL & Server Configuration
```
Production: https://your-domain.com
Development: http://localhost:5000
Current Port: 5000
```

**Environment Variables You'll Need:**
```env
API_BASE_URL=http://localhost:5000
```

---

## 🔐 Authentication System

### How It Works
The backend uses **JWT (JSON Web Tokens)** for authentication - perfect for mobile apps!

### 1. Login Endpoint
```
POST /api/auth/login
```

**Request Body:**
```json
{
  "identifier": "BU22CSC1061",    // Matric Number (for students)
  "password": "StudentPassword123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "student_id_here",
    "firstName": "Nofisat",
    "lastName": "Shoyyinka",
    "matricNo": "BU22CSC1061",
    "email": "nofisat@example.com",
    "level": 200,
    "gender": "female",
    "college": {...},
    "department": {...},
    "paymentStatus": "pending",
    "reservationStatus": "none",
    "role": "student",
    "firstLogin": true
  }
}
```

### 2. How to Store Token in Mobile App

**React Native (Async Storage):**
```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// After login success
await AsyncStorage.setItem('authToken', response.token);
await AsyncStorage.setItem('user', JSON.stringify(response.user));

// Retrieve token
const token = await AsyncStorage.getItem('authToken');
```

**Flutter (Shared Preferences):**
```dart
import 'package:shared_preferences/shared_preferences.dart';

// After login
final prefs = await SharedPreferences.getInstance();
await prefs.setString('authToken', response.token);

// Retrieve
final token = prefs.getString('authToken');
```

### 3. Making Authenticated Requests

**All student endpoints require this header:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**React Native Example (Axios):**
```javascript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Add token to every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Usage
const response = await api.get('/student/dashboard');
```

**Flutter Example (Dio):**
```dart
import 'package:dio/dio.dart';

class ApiService {
  final Dio _dio = Dio(BaseOptions(
    baseUrl: 'http://localhost:5000/api',
  ));

  Future<void> _addAuthHeader() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('authToken');
    if (token != null) {
      _dio.options.headers['Authorization'] = 'Bearer $token';
    }
  }

  Future<Response> getDashboard() async {
    await _addAuthHeader();
    return await _dio.get('/student/dashboard');
  }
}
```

---

## 📋 Complete API Endpoints for Student Mobile App

### 🏠 Authentication & Profile

#### 1. Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "identifier": "BU22CSC1061",  // Matric Number
  "password": "password123"
}
```

#### 2. Get Profile
```http
GET /api/auth/profile
Authorization: Bearer {token}
```

#### 3. Update Profile
```http
PUT /api/auth/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "phoneNumber": "08012345678",
  "address": "123 Main Street",
  "emergencyContact": "08098765432"
}
```

#### 4. Change Password
```http
PUT /api/auth/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

#### 5. Forgot Password
```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "student@example.com"
}
```

---

### 📊 Dashboard

#### Get Dashboard Data
```http
GET /api/student/dashboard
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "student": {
      "_id": "...",
      "firstName": "Nofisat",
      "lastName": "Shoyyinka",
      "matricNo": "BU22CSC1061",
      "level": 200,
      "paymentStatus": "paid",
      "reservationStatus": "confirmed",
      "assignedHostel": {...},
      "assignedRoom": {...},
      "assignedBunk": {...}
    },
    "hasPayment": true,
    "hasReservation": true,
    "roommates": [...]
  }
}
```

---

### 💰 Payment System

#### 1. Get Payment Amount
```http
GET /api/student/payment/amount
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "amount": 25000
}
```

#### 2. Check Payment Status
```http
GET /api/student/payment/status
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "amount": 25000,
    "status": "paid",  // or "pending"
    "reference": "PAY_abc123xyz",
    "paidAt": "2025-12-05T10:30:00.000Z"
  }
}
```

#### 3. Initialize Payment
```http
POST /api/student/payment/initialize
Authorization: Bearer {token}
Content-Type: application/json

{}  // Body can be empty, uses default amount
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reference": "PAY_abc123xyz",
    "paymentCode": "AB12CD",  // 6-character code sent via email
    "authorizationUrl": "https://checkout.paystack.com/abc123",
    "accessCode": "abc123xyz"
  }
}
```

#### 4. Open Paystack Payment (Mobile)

**React Native:**
```javascript
import { Linking } from 'react-native';

// After initializing payment
const { authorizationUrl } = response.data;
await Linking.openURL(authorizationUrl);

// Or use react-native-paystack-webview
import { PaystackWebView } from 'react-native-paystack-webview';

<PaystackWebView
  paystackKey="pk_test_f5ab1691491857e39c3ca1221d7e8d5680317b13"
  amount={25000}
  billingEmail="student@example.com"
  billingName="Nofisat Shoyyinka"
  onCancel={() => console.log('Payment cancelled')}
  onSuccess={(ref) => verifyPayment(ref.transactionRef.reference)}
/>
```

**Flutter:**
```dart
import 'package:flutter_paystack/flutter_paystack.dart';

final plugin = PaystackPlugin();
plugin.initialize(publicKey: 'pk_test_f5ab...');

Charge charge = Charge()
  ..amount = 2500000  // Amount in kobo (25000 * 100)
  ..email = 'student@example.com'
  ..reference = response.data.reference;

CheckoutResponse checkoutResponse = await plugin.checkout(
  context,
  charge: charge,
);

if (checkoutResponse.status) {
  // Verify payment with backend
  verifyPaymentCode(paymentCode);
}
```

#### 5. Verify Payment with Code (IMPORTANT!)
```http
POST /api/student/payment/verify-code
Authorization: Bearer {token}
Content-Type: application/json

{
  "paymentCode": "AB12CD"  // 6-character code from email
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "payment": {...},
    "student": {
      "paymentStatus": "paid"
    }
  }
}
```

---

### 🏨 Hostel & Room Browsing

#### 1. Get Available Hostels
```http
GET /api/student/hostels
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "hostels": [
    {
      "_id": "hostel_id",
      "name": "Hostel A",
      "level": 200,
      "gender": "female",
      "totalRooms": 50,
      "description": "Modern hostel with excellent facilities"
    }
  ]
}
```

#### 2. Get Rooms in Hostel (WITH AVAILABILITY!)
```http
GET /api/student/hostels/{hostelId}/rooms
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "room_id",
      "roomNumber": "101",
      "floor": 1,
      "capacity": 4,
      "level": 200,
      "status": "partially_occupied",  // ⚠️ IGNORE THIS - may be outdated
      "bunks": [...],
      "availableSpaces": 2,        // ✅ USE THIS - Real-time count
      "currentOccupants": 2,        // ✅ Number of occupied bunks
      "reservedSpaces": 0,          // ✅ Number of reserved bunks
      "isAvailable": true           // ✅ USE THIS to show/hide booking button
    }
  ]
}
```

**⚠️ IMPORTANT:** Always use `isAvailable` field, NOT `status` field for determining if a room can be booked!

#### 3. Get Bunks in Room
```http
GET /api/student/rooms/{roomId}/bunks
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "bunk_id",
      "bunkNumber": "B1",
      "status": "available",  // or "reserved", "occupied"
      "room": "room_id",
      "isActive": true
    }
  ]
}
```

---

### 🛏️ Room Reservation

**Important Notes:**
- ❌ **DO NOT send `hostelId`** - The backend automatically gets it from the room
- ✅ **Only send `roomId`** (required)
- ✅ `bunkId` is optional - backend auto-assigns if not provided
- ✅ For group reservations, `roommates` must be **student ObjectIds**, not matric numbers
- ✅ Use `isGroupReservation: true` when reserving with friends

#### 1. Individual Reservation
```http
POST /api/student/reserve
Authorization: Bearer {token}
Content-Type: application/json

{
  "roomId": "692da99af8270cc142af0044"
  // "bunkId" is optional - auto-selected if not provided
}
```

**Response:**
```json
{
  "success": true,
  "message": "Reservation created successfully",
  "data": {
    "student": "student_id",
    "room": {
      "id": "room_id",
      "number": "101",
      "floor": 1
    },
    "hostel": {
      "id": "hostel_id",
      "name": "Hostel A"
    },
    "bunk": {
      "id": "bunk_id",
      "number": "B1"
    },
    "status": "confirmed",
    "reservedAt": "2025-12-16T10:00:00.000Z",
    "expiresAt": "2025-12-17T10:00:00.000Z",
    "isGroupReservation": false,
    "groupMembers": []
  }
}
```

#### 2. Group Reservation (with Friends)
```http
POST /api/student/reserve
Authorization: Bearer {token}
Content-Type: application/json

{
  "roomId": "692da99af8270cc142af0044",
  "roommates": ["student_id_1", "student_id_2"],
  "isGroupReservation": true
  // Note: DO NOT send "hostelId" - it's obtained from the room
  // Note: "roommates" must be student ObjectIds, not matric numbers
}
```

**Response:**
```json
{
  "success": true,
  "message": "Group reservation successful! Reserved 3 bunks.",
  "data": {
    "student": "student_id",
    "room": {
      "id": "room_id",
      "number": "101",
      "floor": 1
    },
    "hostel": {
      "id": "hostel_id",
      "name": "Hostel A"
    },
    "bunk": {
      "id": "bunk_id",
      "number": "B1"
    },
    "status": "confirmed",
    "reservedAt": "2025-12-16T10:00:00.000Z",
    "expiresAt": "2025-12-17T10:00:00.000Z",
    "isGroupReservation": true,
    "groupMembers": [
      {
        "id": "student_id_1",
        "matricNo": "BU22CSC1062",
        "name": "Jane Doe",
        "bunk": "B2"
      },
      {
        "id": "student_id_2",
        "matricNo": "BU22CSC1063",
        "name": "John Smith",
        "bunk": "B3"
      }
    ]
  }
}
```

#### 3. Get Current Reservation
```http
GET /api/student/reservation
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hostel": {
      "name": "Hostel A",
      "level": 200
    },
    "room": {
      "roomNumber": "101",
      "floor": 1
    },
    "bunk": {
      "bunkNumber": "B1",
      "status": "reserved"
    },
    "roommates": [
      {
        "firstName": "Mary",
        "lastName": "Alabi",
        "matricNo": "BU22CSC1063"
      }
    ],
    "reservationStatus": "confirmed",
    "checkInDate": null
  }
}
```

---

## 🎨 Mobile App UI Flow

### Recommended Screen Flow

```
1. Splash Screen
   ↓
2. Login Screen
   ↓
3. First Login? → Force Password Change
   ↓
4. Dashboard Screen
   ├── Profile Card (name, matric, level)
   ├── Payment Status Widget
   │   ├── Not Paid → "Make Payment" button
   │   └── Paid → Green checkmark
   ├── Reservation Status Widget
   │   ├── No Reservation → "Browse Hostels" button
   │   └── Reserved → Show room details
   └── Quick Actions
       ├── View Hostels
       ├── View Reservation
       └── Profile Settings

5. Payment Flow
   ├── Payment Amount Screen
   ├── Paystack Webview
   ├── Payment Code Input Screen (6-digit)
   └── Payment Success Screen

6. Hostel Browsing Flow
   ├── Hostels List Screen
   │   └── Filter by level/gender (auto)
   ├── Rooms List Screen
   │   └── Show availableSpaces, currentOccupants
   ├── Bunks List Screen (if individual)
   └── Group Reservation Screen (if group)
       ├── Add Friends (matric numbers)
       ├── Room auto-assigns bunks
       └── Confirm Reservation

7. Reservation Details Screen
   ├── Hostel Name
   ├── Room Number
   ├── Bunk Number
   ├── Roommates List
   └── QR Code (for check-in)

8. Profile Screen
   ├── Personal Info
   ├── Academic Info
   ├── Contact Info
   ├── Change Password
   └── Logout
```

---

## 🔄 State Management Recommendations

### React Native (Context API)
```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (identifier, password) => {
    try {
      const response = await api.post('/auth/login', { identifier, password });
      
      await AsyncStorage.setItem('authToken', response.data.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
      
      setToken(response.data.token);
      setUser(response.data.user);
      
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

### Flutter (Provider/Riverpod)
```dart
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthProvider extends ChangeNotifier {
  String? _token;
  Map<String, dynamic>? _user;
  bool _loading = true;

  String? get token => _token;
  Map<String, dynamic>? get user => _user;
  bool get loading => _loading;
  bool get isAuthenticated => _token != null;

  Future<void> loadStoredAuth() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('authToken');
    final userJson = prefs.getString('user');
    
    if (userJson != null) {
      _user = jsonDecode(userJson);
    }
    
    _loading = false;
    notifyListeners();
  }

  Future<void> login(String identifier, String password) async {
    final response = await apiService.login(identifier, password);
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('authToken', response['token']);
    await prefs.setString('user', jsonEncode(response['user']));
    
    _token = response['token'];
    _user = response['user'];
    notifyListeners();
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('authToken');
    await prefs.remove('user');
    
    _token = null;
    _user = null;
    notifyListeners();
  }
}
```

---

## 🔌 Backend Configuration for Mobile

### 1. CORS Setup (Already Enabled)
The backend already has CORS enabled, so your mobile app can make requests directly.

### 2. Base URLs by Environment

**Development (Testing on Emulator/Simulator):**
```
Android Emulator: http://10.0.2.2:5000
iOS Simulator: http://localhost:5000
Physical Device (same network): http://192.168.x.x:5000
```

**Production:**
```
Deploy backend to cloud service (Heroku, Railway, Render, etc.)
Use production URL: https://stayhub-api.com
```

### 3. Finding Your Local IP (for Physical Device Testing)

**Windows:**
```cmd
ipconfig
# Look for IPv4 Address (e.g., 192.168.1.5)
```

**Mac/Linux:**
```bash
ifconfig
# Look for inet address
```

Then use: `http://192.168.1.5:5000`

---

## 📦 Required Mobile App Features

### Must-Have Features
1. ✅ **Authentication**
   - Login with matric number
   - Token storage
   - Auto-logout on token expiry
   - First login password change

2. ✅ **Payment Integration**
   - Display payment amount
   - Paystack payment gateway
   - Payment code verification
   - Payment status tracking

3. ✅ **Hostel Browsing**
   - List available hostels (filtered by level/gender)
   - View rooms with real-time availability
   - Show available spaces clearly
   - Disable full rooms

4. ✅ **Room Reservation**
   - Individual reservation
   - Group reservation with friends
   - Real-time availability check
   - Confirmation screens

5. ✅ **Dashboard**
   - Payment status widget
   - Reservation summary
   - Quick actions
   - Profile overview

6. ✅ **Profile Management**
   - View personal info
   - Update contact details
   - Change password

### Nice-to-Have Features
- 🔔 Push notifications for reservation expiry
- 📱 QR code for check-in
- 💬 In-app chat with porter
- 📊 Payment history
- 🌓 Dark mode
- 📴 Offline mode (cached data)

---

## 🚀 Deployment Checklist

### Backend Deployment
1. Choose cloud service (Heroku, Railway, Render, AWS, DigitalOcean)
2. Set environment variables:
   ```
   MONGODB_URI=<production_mongodb_url>
   JWT_SECRET=<strong_secret_key>
   PAYSTACK_SECRET_KEY=<paystack_secret>
   FRONTEND_URL=<mobile_app_scheme>
   NODE_ENV=production
   ```
3. Deploy and get production URL
4. Update PAYSTACK_CALLBACK_URL to production URL

### Mobile App Deployment
1. **React Native:**
   - Build APK: `cd android && ./gradlew assembleRelease`
   - Build iOS: Open Xcode and archive
   - Update API base URL in code

2. **Flutter:**
   - Build APK: `flutter build apk --release`
   - Build iOS: `flutter build ios --release`
   - Update API base URL in code

---

## 🐛 Common Issues & Solutions

### Issue 1: Cannot Connect to Backend
**Solution:**
- Ensure backend is running
- Check if using correct IP address
- For Android emulator, use `10.0.2.2` instead of `localhost`
- Check if CORS is enabled (already enabled in this backend)

### Issue 2: Token Expiration
**Solution:**
```javascript
// Add interceptor to handle 401 errors
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Token expired - logout user
      await logout();
      navigation.navigate('Login');
    }
    return Promise.reject(error);
  }
);
```

### Issue 3: Paystack Payment Not Working
**Solution:**
- Ensure using correct public key
- Amount should be in kobo (multiply by 100)
- Email must be valid
- Reference must match backend record

### Issue 4: Rooms Showing Incorrect Availability
**Problem:** Room shows as "full" but actually has available bunks

**Root Cause:** The `room.status` field in database may be outdated

**Solution:**
- ✅ **USE** `room.isAvailable` field (calculated from real-time bunk data)
- ✅ **USE** `room.availableSpaces` to show count
- ❌ **DON'T USE** `room.status` field
- Backend fix applied: API now returns ALL active rooms with real-time availability

**Code Example:**
```javascript
// ✅ CORRECT
const canBook = room.isAvailable;
const availableCount = room.availableSpaces;

// ❌ WRONG - Don't do this
const canBook = room.status !== 'full';  // This field may be wrong!
```

---

## 📚 Recommended Mobile Libraries

### React Native
```json
{
  "dependencies": {
    "@react-navigation/native": "^6.x",
    "@react-navigation/stack": "^6.x",
    "@react-native-async-storage/async-storage": "^1.x",
    "axios": "^1.x",
    "react-native-paystack-webview": "^3.x",
    "react-native-vector-icons": "^10.x",
    "react-native-qrcode-svg": "^6.x"
  }
}
```

### Flutter
```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.1.0
  dio: ^5.4.0
  shared_preferences: ^2.2.2
  flutter_paystack: ^1.0.7
  provider: ^6.1.1
  qr_flutter: ^4.1.0
```

---

## 🎯 Next Steps

1. **Choose Framework:**
   - React Native (if you know JavaScript/React)
   - Flutter (if you know Dart, better performance)

2. **Set Up Project:**
   ```bash
   # React Native
   npx react-native init StayHubStudent
   
   # Flutter
   flutter create stayhub_student
   ```

3. **Install Dependencies:**
   - HTTP client (Axios/Dio)
   - Navigation library
   - Paystack SDK
   - Storage library

4. **Configure API Service:**
   - Create API client with base URL
   - Add authentication interceptor
   - Handle errors globally

5. **Build Features in Order:**
   - ✅ Authentication (Login, Token Storage)
   - ✅ Dashboard (Display user info)
   - ✅ Payment Flow (Initialize, Verify)
   - ✅ Hostel Browsing (List, Filter)
   - ✅ Room Reservation (Individual/Group)
   - ✅ Profile Management

---

## 📞 API Testing Tools

Before building the app, test all endpoints:

**Postman Collection:**
```json
{
  "info": {
    "name": "StayHub Student API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "url": "{{base_url}}/api/auth/login",
            "body": {
              "mode": "raw",
              "raw": "{\n  \"identifier\": \"BU22CSC1061\",\n  \"password\": \"password123\"\n}"
            }
          }
        }
      ]
    }
  ]
}
```

**Environment Variables:**
```
base_url: http://localhost:5000
token: <paste_token_after_login>
```

---

## ✅ Summary

**YES, you can build a mobile app for the student portal!**

**What You Need:**
1. ✅ Backend URL (localhost:5000 or production URL)
2. ✅ Paystack Public Key: `pk_test_f5ab1691491857e39c3ca1221d7e8d5680317b13`
3. ✅ All API endpoints (documented above)
4. ✅ JWT token handling
5. ✅ Mobile framework (React Native or Flutter)

**Key Integration Points:**
- Authentication with matric number + password
- JWT token in Authorization header
- Paystack payment gateway
- Real-time room availability
- 6-character payment code verification

**The backend is ready!** Just choose your mobile framework and start building! 🚀

---

**Generated:** December 16, 2025  
**Backend Version:** 1.0.0  
**Base URL:** http://localhost:5000
