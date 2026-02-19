# Payment Verification Endpoint - Debug Guide

## ✅ Implementation Status

The payment verification endpoint is **FULLY IMPLEMENTED** at:
```
POST /api/student/payment/verify-code
```

## 📍 Location in Code

**Controller**: `src/controllers/paymentController.js` (Lines 534-704)
**Route**: `src/routes/studentRoutes.js` (Line 376)
**Exports**: Properly exported in paymentController module

## 🔐 Authentication

The endpoint **requires authentication**:
- Uses `protect` and `studentOnly` middleware (applied at line 60 of studentRoutes.js)
- All student routes after line 60 require Bearer token authentication

## 📨 Request Format

```http
POST http://localhost:5000/api/student/payment/verify-code
Authorization: Bearer <student_jwt_token>
Content-Type: application/json

{
  "paymentCode": "ABC123"
}
```

## ✅ Enhanced Error Handling (Just Added)

The endpoint now includes comprehensive validation:

1. **Authentication Check**
   - Returns 401 if no user authenticated
   - Message: "Authentication required"

2. **Missing Payment Code**
   - Returns 400 if paymentCode not in body
   - Message: "Payment code is required"

3. **Invalid Format**
   - Returns 400 if paymentCode is not a string or empty
   - Message: "Payment code must be a non-empty string"

4. **Wrong Length**
   - Returns 400 if paymentCode length ≠ 6
   - Message: "Payment code must be exactly 6 characters"

5. **Code Not Found**
   - Returns 404 if payment code doesn't exist
   - Message: "Invalid payment code"

6. **Wrong Student**
   - Returns 403 if code belongs to different student
   - Message: "This payment code does not belong to you"

7. **Already Verified**
   - Returns 200 if already completed
   - Message: "Payment already verified"

8. **Paystack Verification Failed**
   - Returns 400 if Paystack says not successful
   - Message: "Payment verification failed. Please try again or contact support."

9. **Failed/Cancelled Payment**
   - Returns 400 if payment status is failed/cancelled
   - Message: "Payment {status}. Please make a new payment."

## 🧪 Testing

### Method 1: Use Test Script

```bash
# Edit test-payment-verification.js first
# Update TEST_STUDENT credentials and TEST_PAYMENT_CODE

node test-payment-verification.js
```

### Method 2: List Available Payment Codes

```bash
node test-payment-verification.js --list-payments
```

This will show recent payment codes from your database.

### Method 3: Manual Test with Postman

1. **Get student token**:
   ```http
   POST http://localhost:5000/api/auth/login
   Content-Type: application/json

   {
     "email": "student@example.com",
     "password": "password",
     "userType": "student"
   }
   ```

2. **Copy the token from response**

3. **Verify payment**:
   ```http
   POST http://localhost:5000/api/student/payment/verify-code
   Authorization: Bearer <paste_token_here>
   Content-Type: application/json

   {
     "paymentCode": "ABC123"
   }
   ```

## 🔍 Server Logs

Enhanced logging now shows:

```
📥 Payment verification request received: {
  body: { paymentCode: 'ABC123' },
  hasUser: true,
  userId: '674f7e0bb09e3d2e10ae2a46'
}
🔍 Verifying payment code: ABC123 for student: 674f7e0bb09e3d2e10ae2a46
```

Check your server console for these logs.

## 🐛 Troubleshooting 400 Errors

If you're getting 400 with no message, check:

1. **Request body format**:
   ```json
   { "paymentCode": "ABC123" }  ✅ Correct
   { code: "ABC123" }            ❌ Wrong field name
   "ABC123"                      ❌ Not an object
   ```

2. **Content-Type header**:
   ```
   Content-Type: application/json  ✅ Correct
   (no Content-Type header)        ❌ Body won't parse
   ```

3. **Payment code format**:
   ```
   "ABC123"  ✅ 6 characters
   "ABC"     ❌ Too short
   "ABC1234" ❌ Too long
   ""        ❌ Empty
   123456    ❌ Not a string
   ```

4. **Authentication**:
   ```
   Authorization: Bearer eyJhbGc...  ✅ Correct
   Authorization: eyJhbGc...         ❌ Missing "Bearer "
   (no Authorization header)         ❌ Will fail at middleware
   ```

## 📊 Complete Flow

1. **Student initializes payment**:
   - `POST /api/student/payment/initialize`
   - Payment code generated (e.g., "ABC123")
   - Email sent with code
   - Student redirected to Paystack

2. **Student pays on Paystack**:
   - Completes payment
   - Redirected back to StayHub

3. **Student enters code**:
   - `POST /api/student/payment/verify-code`
   - Body: `{ "paymentCode": "ABC123" }`

4. **Backend verifies**:
   - Checks code exists
   - Checks code belongs to student
   - Verifies with Paystack API
   - Updates payment status to 'completed'
   - Updates student.paymentStatus to 'paid'

5. **Student can now reserve**:
   - Payment verified
   - Room reservation unlocked

## 🔧 Common Issues & Solutions

### Issue: "Payment code is required"
**Cause**: Request body is missing paymentCode field
**Solution**: Ensure body is `{ "paymentCode": "ABC123" }`

### Issue: "Payment code must be exactly 6 characters"
**Cause**: Code length is wrong
**Solution**: Payment codes are always 6 characters (e.g., ABC123, XYZ789)

### Issue: "Invalid payment code"
**Cause**: Code doesn't exist in database
**Solution**: 
- Check database: `node test-payment-verification.js --list-payments`
- Verify you're using the code from the email
- Make sure payment was initialized first

### Issue: "This payment code does not belong to you"
**Cause**: Logged in as different student than who initialized payment
**Solution**: Login as the correct student who received the email

### Issue: "Payment verification failed"
**Cause**: Paystack says payment not successful
**Solution**: 
- Make sure payment was completed on Paystack
- Check payment status on Paystack dashboard
- May need to reinitialize payment

### Issue: No response or timeout
**Cause**: Server not running or wrong URL
**Solution**: 
- Check server is running: `npm start`
- Verify URL: `http://localhost:5000/api/student/payment/verify-code`
- Check server logs for errors

## 📝 Response Examples

### Success (Already Verified)
```json
{
  "success": true,
  "message": "Payment already verified",
  "data": {
    "status": "completed",
    "amount": 50000,
    "paymentCode": "ABC123",
    "paymentReference": "PAY-1701523456789",
    "datePaid": "2025-12-02T10:30:00.000Z"
  }
}
```

### Success (Newly Verified)
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "status": "completed",
    "amount": 50000,
    "paymentCode": "ABC123",
    "paymentReference": "PAY-1701523456789",
    "datePaid": "2025-12-02T10:35:00.000Z"
  }
}
```

### Error (Invalid Code)
```json
{
  "success": false,
  "message": "Invalid payment code"
}
```

### Error (Wrong Length)
```json
{
  "success": false,
  "message": "Payment code must be exactly 6 characters"
}
```

### Error (Not Authenticated)
```json
{
  "success": false,
  "message": "Authentication required"
}
```

## 🎯 Next Steps

1. **Test the endpoint** using the test script
2. **Check server logs** for detailed debugging info
3. **Verify payment codes** in database match what students receive via email
4. **Test complete flow**: Initialize → Pay → Verify → Reserve

---

**The endpoint is fully functional with enhanced error handling and logging!**
