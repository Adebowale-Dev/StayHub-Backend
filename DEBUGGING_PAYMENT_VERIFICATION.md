# Payment Verification Debugging Guide

## 🔍 Enhanced Logging Now Active

The payment verification endpoint now has **EXTREMELY DETAILED LOGGING** at every step.

## 📊 What You'll See in Server Logs

### During Payment Initialization

```
💳 Creating payment record:
   Payment Code: ABC123
   Reference: PAY-1701523456789
   Amount: 50000
   Student ID: 674f7e0bb09e3d2e10ae2a46

✅ Payment record created in database:
   Payment ID: 674f7e0bb09e3d2e10ae2a47
   Payment Code (saved): ABC123
   Status: pending

📧 Sending payment code email...
✅ Payment code email sent to: student@example.com
```

### During Payment Verification

```
📥 Payment verification request received: {
  body: { paymentCode: 'ABC123' },
  hasUser: true,
  userId: '674f7e0bb09e3d2e10ae2a46'
}

🔍 Step 1: Searching for payment
   Payment Code (uppercase): ABC123
   Student ID: 674f7e0bb09e3d2e10ae2a46

🔍 Step 2: Database query result
   Payment found: true

✅ Step 3: Payment found
   Payment ID: 674f7e0bb09e3d2e10ae2a47
   Payment Code: ABC123
   Status: pending
   Reference: PAY-1701523456789
   Amount: 50000
   Created: 2025-12-02T10:30:00.000Z

🔍 Step 4: Payment pending, verifying with Paystack...
   Reference: PAY-1701523456789
   Paystack Secret Key exists: true
   Paystack Secret Key (first 10 chars): sk_test_83...

🔍 Step 5: Calling Paystack verification API...

🔍 Step 6: Paystack response received
   Verification status: success
   Payment status: success
   Amount: 5000000
   Currency: NGN
   Full response: {...}

✅ Step 7: Paystack verification successful - Updating database...
✅ Step 8: Payment record updated
✅ Step 9: Student payment status updated
```

## 🚨 Error Scenarios & Their Logs

### 1. Payment Code Not Found

```
🔍 Step 1: Searching for payment
   Payment Code (uppercase): WRONG1
   Student ID: 674f7e0bb09e3d2e10ae2a46

🔍 Step 2: Database query result
   Payment found: false

❌ Payment not found in database
   Searched for code: WRONG1
   Student ID: 674f7e0bb09e3d2e10ae2a46
   Student has these recent payments:
      - Code: ABC123 | Status: pending | Ref: PAY-1701523456789
      - Code: XYZ789 | Status: completed | Ref: PAY-1701523400000
   ⚠️ Code does not exist in database at all
```

**What This Means**: The code doesn't exist. Student may have typed it wrong or payment wasn't initialized.

**Solution**: 
- Check the email for correct code
- Verify payment was initialized
- Use `node list-payment-codes.js` to see available codes

---

### 2. Code Belongs to Different Student

```
🔍 Step 2: Database query result
   Payment found: false

❌ Payment not found in database
   Searched for code: ABC123
   Student ID: 674f7e0bb09e3d2e10ae2a46
   Student has these recent payments:
      - Code: DEF456 | Status: pending | Ref: PAY-1701523500000
   ⚠️ Code exists but belongs to different student: 674f7e0bb09e3d2e10ae2a99
```

**What This Means**: The code exists but belongs to a different student.

**Solution**: Student is using wrong account or wrong code. They should:
- Login with the correct account
- Use the code from their own email

---

### 3. Paystack Verification Failed

```
🔍 Step 6: Paystack response received
   Verification status: success
   Payment status: failed
   Amount: 5000000
   Currency: NGN

❌ Paystack verification failed
   Expected status: success
   Received status: failed
   Verification object: {...}
```

**What This Means**: Paystack says payment wasn't successful.

**Possible Reasons**:
- Payment was declined
- Payment was cancelled
- Insufficient funds
- Card declined

**Solution**: Student needs to make a new payment.

---

### 4. Paystack API Error

```
❌ PAYSTACK VERIFICATION ERROR
   Error type: AxiosError
   Error message: Request failed with status code 404
   HTTP Status: 404
   Response data: {
     "status": false,
     "message": "Transaction reference not found"
   }
```

**What This Means**: Paystack doesn't know about this transaction reference.

**Possible Reasons**:
- Payment wasn't actually initialized with Paystack
- Wrong Paystack secret key
- Reference is incorrect

**Solution**: 
- Check PAYSTACK_SECRET_KEY in .env
- Verify payment initialization succeeded
- Check Paystack dashboard for the transaction

---

### 5. Missing Paystack Secret Key

```
🔍 Step 4: Payment pending, verifying with Paystack...
   Reference: PAY-1701523456789
   Paystack Secret Key exists: false
   Paystack Secret Key (first 10 chars): undefined...

❌ PAYSTACK VERIFICATION ERROR
   Error message: Cannot read property 'substring' of undefined
```

**What This Means**: PAYSTACK_SECRET_KEY is not set in .env

**Solution**: Add to .env file:
```env
PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here
```

---

### 6. Network Error to Paystack

```
❌ PAYSTACK VERIFICATION ERROR
   Error type: Error
   Error message: connect ETIMEDOUT
   No response received from Paystack
```

**What This Means**: Can't reach Paystack servers.

**Solution**: 
- Check internet connection
- Check firewall settings
- Try again later

---

### 7. Payment Already Completed

```
✅ Step 3: Payment found
   Status: completed

✅ Payment already verified
```

**What This Means**: Payment was already verified before.

**Response**: 200 OK with payment details (not an error)

---

### 8. Payment Failed/Cancelled

```
✅ Step 3: Payment found
   Status: failed

❌ Payment status is: failed
```

**What This Means**: Payment was marked as failed or cancelled.

**Solution**: Student needs to make a new payment.

---

## 🛠️ Debugging Commands

### 1. Check What Payment Codes Exist
```bash
node list-payment-codes.js
```

### 2. Run Full Test Suite
```bash
# Edit test-payment-verification.js first
node test-payment-verification.js
```

### 3. Watch Server Logs in Real-Time
```bash
npm start
# Watch the console output carefully
```

### 4. Check Paystack Secret Key
```bash
# In terminal/PowerShell:
echo $env:PAYSTACK_SECRET_KEY

# Or check .env file directly
```

### 5. Query Database Directly
```javascript
// In MongoDB Compass or shell:
db.payments.find({ paymentCode: "ABC123" })
```

## 📋 Checklist When Debugging

- [ ] Server is running (`npm start`)
- [ ] Payment was initialized (check logs for "Payment record created")
- [ ] Email was sent (check logs for "Payment code email sent")
- [ ] Student has the correct payment code from email
- [ ] Student is logged in with correct account
- [ ] Payment code is exactly 6 characters
- [ ] PAYSTACK_SECRET_KEY exists in .env
- [ ] Paystack secret key is correct (check Paystack dashboard)
- [ ] Internet connection is working
- [ ] Payment was completed on Paystack gateway

## 🎯 Most Common Issues

### Issue #1: Code Not in Database
**Log Shows**: "Code does not exist in database at all"

**Check**:
1. Was payment initialized? Look for "Payment record created" log
2. Run `node list-payment-codes.js` to see what codes exist
3. Student may need to initialize payment again

### Issue #2: Payment Not Completed on Paystack
**Log Shows**: "Payment status: pending" or "failed"

**Check**:
1. Did student actually complete payment on Paystack gateway?
2. Check Paystack dashboard for transaction status
3. Student may need to complete the payment first

### Issue #3: Wrong Student Account
**Log Shows**: "Code exists but belongs to different student"

**Check**:
1. Which email received the payment code?
2. Is student logged in with that email?
3. Student needs to login with correct account

### Issue #4: Typo in Payment Code
**Log Shows**: Student's recent codes are listed but don't match input

**Check**:
1. Compare input code with codes in "Student has these recent payments"
2. Check for typos (O vs 0, I vs 1, etc.)
3. Payment codes are case-insensitive but must be exact

## 📞 When to Contact Support

If you see these in logs:
- ❌ CRITICAL ERROR
- Network timeouts repeatedly
- Paystack API returns 500 errors
- Database connection errors
- Unexpected error types

Otherwise, the detailed logs should tell you exactly what's wrong!

---

**The backend now has COMPREHENSIVE LOGGING. Just restart your server and watch the console!**
