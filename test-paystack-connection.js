require('dotenv').config();
const axios = require('axios');
async function testPaystackConnection() {
    console.log('🔌 Testing Paystack API Connection\n');
    console.log('='.repeat(60));
    try {
        console.log('\n1️⃣ Checking Paystack Secret Key...');
        if (!process.env.PAYSTACK_SECRET_KEY) {
            console.log('❌ PAYSTACK_SECRET_KEY not found in .env');
            console.log('   Please add: PAYSTACK_SECRET_KEY=sk_test_your_key_here');
            process.exit(1);
        }
        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        console.log('✅ Secret key found');
        console.log('   Starts with:', secretKey.substring(0, 15) + '...');
        console.log('   Length:', secretKey.length, 'characters');
        console.log('\n2️⃣ Testing Paystack API connection...');
        try {
            const response = await axios.get('https://api.paystack.co/transaction', {
                headers: {
                    'Authorization': `Bearer ${secretKey}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    perPage: 1
                }
            });
            console.log('✅ API connection successful!');
            console.log('   Status:', response.status);
            console.log('   Response:', response.data.status ? 'Valid' : 'Invalid');
            if (response.data.data && response.data.data.length > 0) {
                const lastTxn = response.data.data[0];
                console.log('\n   Last transaction:');
                console.log('     Reference:', lastTxn.reference);
                console.log('     Status:', lastTxn.status);
                console.log('     Amount:', lastTxn.amount / 100, 'NGN');
                console.log('     Date:', new Date(lastTxn.created_at).toLocaleString());
            }
        }
        catch (apiError) {
            if (apiError.response) {
                console.log('❌ API request failed');
                console.log('   Status:', apiError.response.status);
                console.log('   Message:', apiError.response.data.message);
                if (apiError.response.status === 401) {
                    console.log('\n⚠️ Authentication failed!');
                    console.log('   Your PAYSTACK_SECRET_KEY is invalid or expired.');
                    console.log('   Get a new one from: https://dashboard.paystack.com/#/settings/developer');
                }
            }
            else if (apiError.request) {
                console.log('❌ No response from Paystack');
                console.log('   Check your internet connection');
            }
            else {
                console.log('❌ Request error:', apiError.message);
            }
            throw apiError;
        }
        console.log('\n3️⃣ Testing transaction verification endpoint...');
        try {
            await axios.get('https://api.paystack.co/transaction/verify/DUMMY_REF_123', {
                headers: {
                    'Authorization': `Bearer ${secretKey}`
                }
            });
        }
        catch (verifyError) {
            if (verifyError.response?.status === 404) {
                console.log('✅ Verification endpoint accessible');
                console.log('   (Got expected 404 for dummy reference)');
            }
            else if (verifyError.response?.status === 401) {
                console.log('❌ Authentication failed on verify endpoint');
                console.log('   Your secret key may be invalid');
            }
            else {
                throw verifyError;
            }
        }
        console.log('\n' + '='.repeat(60));
        console.log('✅ ALL TESTS PASSED!');
        console.log('\nYour Paystack integration is configured correctly.');
        console.log('Payment verification should work properly.\n');
    }
    catch (error) {
        console.log('\n' + '='.repeat(60));
        console.log('❌ TESTS FAILED\n');
        console.log('Troubleshooting steps:');
        console.log('1. Verify PAYSTACK_SECRET_KEY in .env file');
        console.log('2. Get secret key from: https://dashboard.paystack.com/#/settings/developer');
        console.log('3. Make sure you\'re using the test key (starts with sk_test_)');
        console.log('4. Check your internet connection');
        console.log('5. Verify Paystack account is active\n');
        process.exit(1);
    }
}
testPaystackConnection();
