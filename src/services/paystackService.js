const paystackAPI = require('../config/paystackConfig');
const config = require('../config/env');

/**
 * Initialize payment transaction
 * @param {object} data - Payment data
 * @param {string} data.email - Customer email
 * @param {number} data.amount - Amount in kobo (multiply naira by 100)
 * @param {string} data.reference - Unique reference
 * @param {object} data.metadata - Additional metadata
 */
const initializeTransaction = async (data) => {
  try {
    const response = await paystackAPI.post('/transaction/initialize', {
      email: data.email,
      amount: data.amount * 100, // Convert to kobo
      reference: data.reference,
      callback_url: config.PAYSTACK_CALLBACK_URL,
      metadata: data.metadata,
      channels: ['card', 'bank', 'ussd', 'bank_transfer'],
    });

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error('Paystack initialization error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to initialize payment');
  }
};

/**
 * Verify payment transaction
 * @param {string} reference - Transaction reference
 */
const verifyTransaction = async (reference) => {
  try {
    const response = await paystackAPI.get(`/transaction/verify/${reference}`);

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error('Paystack verification error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'Failed to verify payment');
  }
};

/**
 * List all transactions
 * @param {object} params - Query parameters
 */
const listTransactions = async (params = {}) => {
  try {
    const response = await paystackAPI.get('/transaction', { params });

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error('Paystack list transactions error:', error.response?.data || error.message);
    throw new Error('Failed to fetch transactions');
  }
};

/**
 * Get transaction details
 * @param {string} id - Transaction ID
 */
const getTransaction = async (id) => {
  try {
    const response = await paystackAPI.get(`/transaction/${id}`);

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error('Paystack get transaction error:', error.response?.data || error.message);
    throw new Error('Failed to fetch transaction details');
  }
};

/**
 * Charge authorization (for recurring payments)
 * @param {object} data - Charge data
 */
const chargeAuthorization = async (data) => {
  try {
    const response = await paystackAPI.post('/transaction/charge_authorization', {
      email: data.email,
      amount: data.amount * 100, // Convert to kobo
      authorization_code: data.authorizationCode,
      reference: data.reference,
      metadata: data.metadata,
    });

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error('Paystack charge error:', error.response?.data || error.message);
    throw new Error('Failed to charge authorization');
  }
};

/**
 * Create transfer recipient
 * @param {object} data - Recipient data
 */
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
  } catch (error) {
    console.error('Paystack create recipient error:', error.response?.data || error.message);
    throw new Error('Failed to create transfer recipient');
  }
};

/**
 * Initiate transfer
 * @param {object} data - Transfer data
 */
const initiateTransfer = async (data) => {
  try {
    const response = await paystackAPI.post('/transfer', {
      source: 'balance',
      amount: data.amount * 100, // Convert to kobo
      recipient: data.recipient,
      reason: data.reason,
      reference: data.reference,
    });

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error('Paystack transfer error:', error.response?.data || error.message);
    throw new Error('Failed to initiate transfer');
  }
};

/**
 * List banks
 */
const listBanks = async () => {
  try {
    const response = await paystackAPI.get('/bank?currency=NGN');

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error) {
    console.error('Paystack list banks error:', error.response?.data || error.message);
    throw new Error('Failed to fetch banks');
  }
};

/**
 * Resolve account number
 * @param {object} data - Account data
 */
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
  } catch (error) {
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
