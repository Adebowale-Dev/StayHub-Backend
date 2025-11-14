require('dotenv').config();

module.exports = {
  // Server
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database
  MONGODB_URI: process.env.MONGODB_URI,
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Paystack
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
  PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY,
  PAYSTACK_CALLBACK_URL: process.env.PAYSTACK_CALLBACK_URL,
  
  // Email
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: process.env.EMAIL_PORT,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM,
  
  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Reservation
  RESERVATION_EXPIRY_HOURS: parseInt(process.env.RESERVATION_EXPIRY_HOURS) || 48,
  PAYMENT_CODE_LENGTH: parseInt(process.env.PAYMENT_CODE_LENGTH) || 6,
  
  // Admin
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
};
