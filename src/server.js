require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const connectDB = require('./config/db');
const config = require('./config/env');
const swaggerSpec = require('./config/swagger');
const { startReservationCleanupJob } = require('./services/reservationCleanupService');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const studentRoutes = require('./routes/studentRoutes');
const porterRoutes = require('./routes/porterRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const corsOptions = {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
    optionsSuccessStatus: 204,
};

const app = express();
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
}));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
    setHeaders: (res) => {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
}));
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const bodyLog = req.method !== 'GET' && req.body ?
        (JSON.stringify(req.body).length > 500 ? '[Body too large]' : JSON.stringify(req.body)) :
        '{}';
    console.log(`
╔════════════════════════════════════════════════════════════
║ ${timestamp}
║ ${req.method} ${req.originalUrl}
║ Body: ${bodyLog}
╚════════════════════════════════════════════════════════════
  `);
    next();
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'StayHub API Documentation',
}));
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});
const shouldSkipRateLimit = config.NODE_ENV === 'development';
const apiLimiter = rateLimit({
    windowMs: config.API_RATE_LIMIT_WINDOW_MS,
    max: config.API_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => shouldSkipRateLimit,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.',
    },
});
const authLimiter = rateLimit({
    windowMs: config.AUTH_RATE_LIMIT_WINDOW_MS,
    max: config.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => shouldSkipRateLimit,
    message: {
        success: false,
        message: 'Too many authentication attempts, please try again later.',
    },
});
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/porter', porterRoutes);
app.use('/api/payments', paymentRoutes);
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'StayHub API is running',
        timestamp: new Date().toISOString(),
    });
});
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Welcome to StayHub API',
        version: '1.0.0',
        documentation: '/api-docs',
        endpoints: {
            auth: '/api/auth',
            admin: '/api/admin',
            student: '/api/student',
            porter: '/api/porter',
            payments: '/api/payments',
        },
    });
});
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
});
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(config.NODE_ENV === 'development' && { stack: err.stack }),
    });
});
const PORT = config.PORT || 5000;
let server;

const startServer = async () => {
    await connectDB();

    server = app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   StayHub - Smart Hostel Management System                ║
║                                                           ║
║   Server running on port ${PORT}                          ║
║   Environment: ${config.NODE_ENV}                         ║
║   API: http://localhost:${PORT}                           ║
║   API Docs: http://localhost:${PORT}/api-docs             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
        startReservationCleanupJob();
    });
};

startServer().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
    if (server) {
        server.close(() => process.exit(1));
        return;
    }
    process.exit(1);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});
module.exports = app;
