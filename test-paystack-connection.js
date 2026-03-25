require('dotenv').config();
const axios = require('axios');

async function testPaystackConnection() {
    console.log('Testing Paystack API connection\n');
    console.log('='.repeat(60));

    try {
        console.log('\n1. Checking Paystack secret key...');

        if (!process.env.PAYSTACK_SECRET_KEY) {
            console.log('PAYSTACK_SECRET_KEY not found in .env');
            console.log('Please add: PAYSTACK_SECRET_KEY=sk_test_your_key_here');
            process.exit(1);
        }

        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        console.log('Secret key found');
        console.log('Starts with:', secretKey.substring(0, 15) + '...');
        console.log('Length:', secretKey.length, 'characters');

        console.log('\n2. Testing Paystack API connection...');

        const response = await axios.get('https://api.paystack.co/transaction', {
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            params: {
                perPage: 1,
            },
        });

        console.log('API connection successful');
        console.log('Status:', response.status);
        console.log('Response:', response.data.status ? 'Valid' : 'Invalid');

        if (response.data.data && response.data.data.length > 0) {
            const lastTxn = response.data.data[0];
            console.log('\nLast transaction:');
            console.log('Reference:', lastTxn.reference);
            console.log('Status:', lastTxn.status);
            console.log('Amount:', lastTxn.amount / 100, 'NGN');
            console.log('Date:', new Date(lastTxn.created_at).toLocaleString());
        }

        console.log('\n3. Testing transaction verification endpoint...');

        try {
            await axios.get('https://api.paystack.co/transaction/verify/DUMMY_REF_123', {
                headers: {
                    Authorization: `Bearer ${secretKey}`,
                },
            });
        }
        catch (verifyError) {
            if (verifyError.response?.status === 401) {
                console.log('Authentication failed on verify endpoint');
                console.log('Your secret key may be invalid');
                throw verifyError;
            }

            if (verifyError.response) {
                console.log('Verification endpoint accessible');
                console.log(`Got expected ${verifyError.response.status} for dummy reference`);
            }
            else {
                throw verifyError;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('All Paystack checks passed');
        console.log('\nYour Paystack integration is reachable and authenticated.\n');
    }
    catch (error) {
        console.log('\n' + '='.repeat(60));
        console.log('Paystack checks failed\n');

        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Message:', error.response.data?.message || error.message);
        }
        else {
            console.log('Error:', error.message);
        }

        console.log('\nTroubleshooting steps:');
        console.log('1. Verify PAYSTACK_SECRET_KEY in .env file');
        console.log('2. Make sure you are using a valid test or live key');
        console.log('3. Check the server internet connection');
        console.log('4. Confirm api.paystack.co is reachable from this machine\n');
        process.exit(1);
    }
}

testPaystackConnection();
