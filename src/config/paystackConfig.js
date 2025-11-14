const axios = require('axios');
const config = require('./env');

const paystackAPI = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

module.exports = paystackAPI;
