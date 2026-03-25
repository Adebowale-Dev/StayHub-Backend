const paystackAPI = require('../config/paystackConfig');
const config = require('../config/env');

const RETRYABLE_NETWORK_CODES = new Set([
    'ECONNABORTED',
    'ECONNRESET',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ETIMEDOUT',
]);

const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const wait = (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});

const isRetryablePaystackError = (error) => {
    if (!error) {
        return false;
    }

    if (!error.response) {
        return RETRYABLE_NETWORK_CODES.has(error.code);
    }

    return RETRYABLE_HTTP_STATUSES.has(error.response.status);
};

const buildPaystackError = (error, fallbackMessage) => {
    const networkError = !error?.response;
    const paystackMessage = error?.response?.data?.message;
    const message = networkError && RETRYABLE_NETWORK_CODES.has(error?.code)
        ? 'Unable to reach Paystack right now. Please check the server internet connection and try again.'
        : paystackMessage || error?.message || fallbackMessage;
    const wrappedError = new Error(message);

    wrappedError.code = error?.code;
    wrappedError.statusCode = error?.response?.status || (networkError ? 503 : 500);
    wrappedError.isNetworkError = networkError;
    wrappedError.details = error?.response?.data;

    return wrappedError;
};

const requestPaystack = async (requestFn, fallbackMessage) => {
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            return await requestFn();
        }
        catch (error) {
            lastError = error;

            if (!isRetryablePaystackError(error) || attempt === 3) {
                break;
            }

            console.warn(`Paystack request attempt ${attempt} failed: ${error.code || error.message}. Retrying...`);
            await wait(attempt * 1000);
        }
    }

    throw buildPaystackError(lastError, fallbackMessage);
};

const handlePaystackRequest = async (requestFn, fallbackMessage, logLabel) => {
    try {
        if (!config.PAYSTACK_SECRET_KEY) {
            const error = new Error('PAYSTACK_SECRET_KEY is not configured');
            error.statusCode = 500;
            throw error;
        }

        const response = await requestPaystack(requestFn, fallbackMessage);
        return {
            success: true,
            data: response.data.data,
            raw: response.data,
        };
    }
    catch (error) {
        console.error(logLabel, error.details || error.message);

        if (error.statusCode) {
            throw error;
        }

        throw buildPaystackError(error, fallbackMessage);
    }
};

const initializeTransaction = async (data) => handlePaystackRequest(() => paystackAPI.post('/transaction/initialize', {
    email: data.email,
    amount: data.amount * 100,
    reference: data.reference,
    callback_url: config.PAYSTACK_CALLBACK_URL,
    metadata: data.metadata,
    channels: ['card', 'bank', 'ussd', 'bank_transfer'],
}), 'Failed to initialize payment', 'Paystack initialization error:');

const verifyTransaction = async (reference) => {
    console.log('Calling Paystack API for reference:', reference);

    const result = await handlePaystackRequest(
        () => paystackAPI.get(`/transaction/verify/${reference}`),
        'Failed to verify payment',
        'Paystack verification error:',
    );

    return {
        success: true,
        status: result.raw.status ? 'success' : 'failed',
        data: result.data,
    };
};

const listTransactions = async (params = {}) => handlePaystackRequest(
    () => paystackAPI.get('/transaction', { params }),
    'Failed to fetch transactions',
    'Paystack list transactions error:',
);

const getTransaction = async (id) => handlePaystackRequest(
    () => paystackAPI.get(`/transaction/${id}`),
    'Failed to fetch transaction details',
    'Paystack get transaction error:',
);

const chargeAuthorization = async (data) => handlePaystackRequest(() => paystackAPI.post('/transaction/charge_authorization', {
    email: data.email,
    amount: data.amount * 100,
    authorization_code: data.authorizationCode,
    reference: data.reference,
    metadata: data.metadata,
}), 'Failed to charge authorization', 'Paystack charge error:');

const createTransferRecipient = async (data) => handlePaystackRequest(() => paystackAPI.post('/transferrecipient', {
    type: data.type || 'nuban',
    name: data.name,
    account_number: data.accountNumber,
    bank_code: data.bankCode,
    currency: data.currency || 'NGN',
}), 'Failed to create transfer recipient', 'Paystack create recipient error:');

const initiateTransfer = async (data) => handlePaystackRequest(() => paystackAPI.post('/transfer', {
    source: 'balance',
    amount: data.amount * 100,
    recipient: data.recipient,
    reason: data.reason,
    reference: data.reference,
}), 'Failed to initiate transfer', 'Paystack transfer error:');

const listBanks = async () => handlePaystackRequest(
    () => paystackAPI.get('/bank?currency=NGN'),
    'Failed to fetch banks',
    'Paystack list banks error:',
);

const resolveAccountNumber = async (data) => handlePaystackRequest(() => paystackAPI.get('/bank/resolve', {
    params: {
        account_number: data.accountNumber,
        bank_code: data.bankCode,
    },
}), 'Failed to resolve account number', 'Paystack resolve account error:');

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
