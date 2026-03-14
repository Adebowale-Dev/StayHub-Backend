const paystackAPI = require('../config/paystackConfig');
const config = require('../config/env');
const initializeTransaction = async (data) => {
    try {
        const response = await paystackAPI.post('/transaction/initialize', {
            email: data.email,
            amount: data.amount * 100,
            reference: data.reference,
            callback_url: config.PAYSTACK_CALLBACK_URL,
            metadata: data.metadata,
            channels: ['card', 'bank', 'ussd', 'bank_transfer'],
        });
        return {
            success: true,
            data: response.data.data,
        };
    }
    catch (error) {
        console.error('Paystack initialization error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to initialize payment');
    }
};
const verifyTransaction = async (reference) => {
    try {
        console.log('📞 Calling Paystack API for reference:', reference);
        const response = await paystackAPI.get(`/transaction/verify/${reference}`);
        console.log('📥 Raw Paystack API response:');
        console.log('   Response status:', response.status);
        console.log('   Response data type:', typeof response.data);
        console.log('   Response data.data type:', typeof response.data.data);
        console.log('   Response data.data.status:', response.data.data?.status);
        console.log('   Response data.data.status type:', typeof response.data.data?.status);
        console.log('   Full response.data:', JSON.stringify(response.data, null, 2));
        return {
            success: true,
            status: response.data.status ? 'success' : 'failed',
            data: response.data.data,
        };
    }
    catch (error) {
        console.error('Paystack verification error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || 'Failed to verify payment');
    }
};
const listTransactions = async (params = {}) => {
    try {
        const response = await paystackAPI.get('/transaction', { params });
        return {
            success: true,
            data: response.data.data,
        };
    }
    catch (error) {
        console.error('Paystack list transactions error:', error.response?.data || error.message);
        throw new Error('Failed to fetch transactions');
    }
};
const getTransaction = async (id) => {
    try {
        const response = await paystackAPI.get(`/transaction/${id}`);
        return {
            success: true,
            data: response.data.data,
        };
    }
    catch (error) {
        console.error('Paystack get transaction error:', error.response?.data || error.message);
        throw new Error('Failed to fetch transaction details');
    }
};
const chargeAuthorization = async (data) => {
    try {
        const response = await paystackAPI.post('/transaction/charge_authorization', {
            email: data.email,
            amount: data.amount * 100,
            authorization_code: data.authorizationCode,
            reference: data.reference,
            metadata: data.metadata,
        });
        return {
            success: true,
            data: response.data.data,
        };
    }
    catch (error) {
        console.error('Paystack charge error:', error.response?.data || error.message);
        throw new Error('Failed to charge authorization');
    }
};
const createTransferRecipient = async (data) => {
    try {
        const response = await paystackAPI.post('/transferrecipient', {
            type: data.type || 'nuban',
            name: data.name,
            account_number: data.accountNumber,
            bank_code: data.bankCode,
            currency: data.currency || 'NGN',
        });
        return {
            success: true,
            data: response.data.data,
        };
    }
    catch (error) {
        console.error('Paystack create recipient error:', error.response?.data || error.message);
        throw new Error('Failed to create transfer recipient');
    }
};
const initiateTransfer = async (data) => {
    try {
        const response = await paystackAPI.post('/transfer', {
            source: 'balance',
            amount: data.amount * 100,
            recipient: data.recipient,
            reason: data.reason,
            reference: data.reference,
        });
        return {
            success: true,
            data: response.data.data,
        };
    }
    catch (error) {
        console.error('Paystack transfer error:', error.response?.data || error.message);
        throw new Error('Failed to initiate transfer');
    }
};
const listBanks = async () => {
    try {
        const response = await paystackAPI.get('/bank?currency=NGN');
        return {
            success: true,
            data: response.data.data,
        };
    }
    catch (error) {
        console.error('Paystack list banks error:', error.response?.data || error.message);
        throw new Error('Failed to fetch banks');
    }
};
const resolveAccountNumber = async (data) => {
    try {
        const response = await paystackAPI.get('/bank/resolve', {
            params: {
                account_number: data.accountNumber,
                bank_code: data.bankCode,
            },
        });
        return {
            success: true,
            data: response.data.data,
        };
    }
    catch (error) {
        console.error('Paystack resolve account error:', error.response?.data || error.message);
        throw new Error('Failed to resolve account number');
    }
};
module.exports = {
    initializeTransaction,
    verifyTransaction,
    listTransactions,
    getTransaction,
    chargeAuthorization,
    createTransferRecipient,
    initiateTransfer,
    listBanks,
    resolveAccountNumber,
};
