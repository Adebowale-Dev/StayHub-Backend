const axios = require('axios');
const config = require('./env');

const paystackAPI = axios.create({
    baseURL: config.PAYSTACK_BASE_URL,
    timeout: 15000,
    headers: {
        Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
    },
});
module.exports = paystackAPI;
