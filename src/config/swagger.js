const swaggerJsdoc = require('swagger-jsdoc');
const authRoutes = require('../routes/authRoutes');
const studentRoutes = require('../routes/studentRoutes');
const adminRoutes = require('../routes/adminRoutes');
const porterRoutes = require('../routes/porterRoutes');
const paymentRoutes = require('../routes/paymentRoutes');

const routeSources = [
    { prefix: '/api/auth', tag: 'Auth', router: authRoutes },
    { prefix: '/api/student', tag: 'Student', router: studentRoutes },
    { prefix: '/api/admin', tag: 'Admin', router: adminRoutes },
    { prefix: '/api/porter', tag: 'Porter', router: porterRoutes },
    { prefix: '/api/payments', tag: 'Payments', router: paymentRoutes },
];

const publicOperations = new Set([
    'POST /api/auth/login',
    'POST /api/auth/forgot-password',
    'POST /api/auth/reset-password',
    'POST /api/porter/apply',
    'GET /api/payments/callback',
    'GET /api/payments/verify/{reference}',
    'GET /api/student/payment/verify/{reference}',
]);

const summaryOverrides = {
    'POST /api/auth/login': 'Login user',
    'POST /api/auth/forgot-password': 'Request password reset',
    'POST /api/auth/reset-password': 'Reset password',
    'GET /api/auth/profile': 'Get current user profile',
    'PUT /api/auth/profile': 'Update current user profile',
    'POST /api/auth/change-password': 'Change current user password',
    'POST /api/auth/logout': 'Logout user',
    'GET /api/admin/dashboard': 'Get admin dashboard statistics',
    'GET /api/admin/notifications/history': 'Get admin notification history',
    'POST /api/admin/notifications/test': 'Send test notification',
    'POST /api/admin/notifications/broadcast': 'Send broadcast notification',
    'GET /api/student/dashboard': 'Get student dashboard',
    'GET /api/student/alerts': 'Get student alerts',
    'GET /api/student/notifications': 'Get student notifications',
    'POST /api/student/notifications/read': 'Mark notifications as read',
    'GET /api/student/invitations/history': 'Get invitation history',
    'POST /api/student/reservation/respond': 'Respond to room invitation',
    'POST /api/student/payment/initialize': 'Initialize student payment',
    'POST /api/student/payment/verify': 'Verify student payment',
    'POST /api/student/payment/verify-code': 'Verify student payment code',
    'POST /api/porter/apply': 'Apply as porter',
    'GET /api/porter/dashboard': 'Get porter dashboard',
    'POST /api/payments/initialize': 'Initialize payment',
    'GET /api/payments/status': 'Get payment status',
    'GET /api/payments/stats': 'Get payment statistics',
};

function normalizeOpenApiPath(prefix, routePath) {
    const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
    const normalizedPath = String(routePath).startsWith('/') ? String(routePath) : `/${routePath}`;
    return `${normalizedPrefix}${normalizedPath}`.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function buildOperationId(method, fullPath) {
    return `${method}_${fullPath}`
        .replace(/[{}]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
}

function extractPathParameters(fullPath) {
    const matches = fullPath.match(/\{([A-Za-z0-9_]+)\}/g) || [];
    return matches.map((match) => {
        const name = match.slice(1, -1);
        return {
            name,
            in: 'path',
            required: true,
            schema: {
                type: 'string',
            },
        };
    });
}

function buildSummary(method, fullPath, tag) {
    const routeKey = `${method.toUpperCase()} ${fullPath}`;
    if (summaryOverrides[routeKey]) {
        return summaryOverrides[routeKey];
    }
    const cleanedPath = fullPath
        .replace(/^\/api\/[^/]+/, '')
        .split('/')
        .filter(Boolean)
        .map((segment) => segment.startsWith('{')
            ? `by ${segment.slice(1, -1)}`
            : segment.replace(/-/g, ' '))
        .join(' ');
    const action = {
        get: 'Get',
        post: 'Create',
        put: 'Update',
        patch: 'Update',
        delete: 'Delete',
    }[method] || method.toUpperCase();
    return cleanedPath ? `${action} ${cleanedPath}` : `${action} ${tag.toLowerCase()}`;
}

function buildRequestBody(fullPath, method) {
    if (method === 'get' || method === 'delete') {
        return undefined;
    }
    const lowerPath = fullPath.toLowerCase();
    if (lowerPath.includes('upload') || lowerPath.includes('picture')) {
        return {
            required: true,
            content: {
                'multipart/form-data': {
                    schema: {
                        type: 'object',
                    },
                },
            },
        };
    }
    return {
        required: false,
        content: {
            'application/json': {
                schema: {
                    type: 'object',
                },
            },
        },
    };
}

function buildResponses(isProtected) {
    const responses = {
        200: {
            description: 'Successful response',
            content: {
                'application/json': {
                    schema: {
                        $ref: '#/components/schemas/Success',
                    },
                },
            },
        },
        400: {
            description: 'Bad request',
            content: {
                'application/json': {
                    schema: {
                        $ref: '#/components/schemas/Error',
                    },
                },
            },
        },
        500: {
            description: 'Internal server error',
            content: {
                'application/json': {
                    schema: {
                        $ref: '#/components/schemas/Error',
                    },
                },
            },
        },
    };
    if (isProtected) {
        responses[401] = {
            description: 'Unauthorized',
            content: {
                'application/json': {
                    schema: {
                        $ref: '#/components/schemas/Error',
                    },
                },
            },
        };
    }
    return responses;
}

function createOperation(method, fullPath, tag) {
    const upperMethod = method.toUpperCase();
    const routeKey = `${upperMethod} ${fullPath}`;
    const isProtected = !publicOperations.has(routeKey);
    const operation = {
        tags: [tag],
        summary: buildSummary(method, fullPath, tag),
        operationId: buildOperationId(method, fullPath),
        responses: buildResponses(isProtected),
    };
    const parameters = extractPathParameters(fullPath);
    const requestBody = buildRequestBody(fullPath, method);
    if (parameters.length > 0) {
        operation.parameters = parameters;
    }
    if (requestBody) {
        operation.requestBody = requestBody;
    }
    if (isProtected) {
        operation.security = [{ bearerAuth: [] }];
    }
    else {
        operation.security = [];
    }
    return operation;
}

function buildPaths() {
    return routeSources.reduce((paths, source) => {
        source.router.stack.forEach((layer) => {
            if (!layer.route || !layer.route.path) {
                return;
            }
            const fullPath = normalizeOpenApiPath(source.prefix, layer.route.path);
            if (!paths[fullPath]) {
                paths[fullPath] = {};
            }
            Object.keys(layer.route.methods).forEach((method) => {
                paths[fullPath][method] = createOperation(method, fullPath, source.tag);
            });
        });
        return paths;
    }, {});
}

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'StayHub - Smart Hostel Management System API',
            version: '1.0.0',
            description: 'Complete API documentation for StayHub hostel management system',
            contact: {
                name: 'StayHub Support',
                email: 'support@stayhub.com',
            },
        },
        servers: [
            {
                url: 'http://localhost:5000',
                description: 'Development server',
            },
            {
                url: 'https://api.stayhub.com',
                description: 'Production server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false,
                        },
                        message: {
                            type: 'string',
                            example: 'Error message',
                        },
                    },
                },
                Success: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: true,
                        },
                        message: {
                            type: 'string',
                            example: 'Operation successful',
                        },
                    },
                },
                College: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011',
                        },
                        name: {
                            type: 'string',
                            example: 'College of Computing and Communication Studies',
                        },
                        code: {
                            type: 'string',
                            example: 'COCCS',
                        },
                        description: {
                            type: 'string',
                            example: 'College of Computing and Communication Studies',
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
                Department: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011',
                        },
                        name: {
                            type: 'string',
                            example: 'Computer Science',
                        },
                        code: {
                            type: 'string',
                            example: 'CSC',
                        },
                        college: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011',
                        },
                        description: {
                            type: 'string',
                            example: 'Department of Computer Science',
                        },
                    },
                },
                Student: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                        },
                        firstName: {
                            type: 'string',
                            example: 'Muhammed',
                        },
                        lastName: {
                            type: 'string',
                            example: 'Abiodun',
                        },
                        matricNo: {
                            type: 'string',
                            example: 'BU22CSC1005',
                        },
                        email: {
                            type: 'string',
                            example: 'muhammedabiodun42@gmail.com',
                        },
                        level: {
                            type: 'number',
                            example: 400,
                        },
                        college: {
                            type: 'string',
                        },
                        department: {
                            type: 'string',
                        },
                        paymentStatus: {
                            type: 'string',
                            enum: ['pending', 'paid', 'failed'],
                            example: 'pending',
                        },
                        reservationStatus: {
                            type: 'string',
                            enum: ['none', 'temporary', 'confirmed', 'checked_in', 'expired'],
                            example: 'none',
                        },
                    },
                },
                Hostel: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                        },
                        name: {
                            type: 'string',
                            example: 'Kings Hostel',
                        },
                        gender: {
                            type: 'string',
                            enum: ['male', 'female', 'mixed'],
                            example: 'male',
                        },
                        totalRooms: {
                            type: 'number',
                            example: 50,
                        },
                        availableRooms: {
                            type: 'number',
                            example: 25,
                        },
                        allowedLevels: {
                            type: 'array',
                            items: {
                                type: 'number',
                            },
                            example: [100, 200, 300, 400],
                        },
                    },
                },
                Room: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                        },
                        roomNumber: {
                            type: 'string',
                            example: 'A101',
                        },
                        hostel: {
                            type: 'string',
                        },
                        capacity: {
                            type: 'number',
                            example: 4,
                        },
                        occupiedSpaces: {
                            type: 'number',
                            example: 2,
                        },
                        status: {
                            type: 'string',
                            enum: ['available', 'full', 'maintenance'],
                            example: 'available',
                        },
                    },
                },
                Payment: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                        },
                        student: {
                            type: 'string',
                        },
                        amount: {
                            type: 'number',
                            example: 50000,
                        },
                        paymentReference: {
                            type: 'string',
                            example: 'PAY_123456789',
                        },
                        paymentCode: {
                            type: 'string',
                            example: '123456',
                        },
                        status: {
                            type: 'string',
                            enum: ['pending', 'successful', 'failed', 'cancelled'],
                            example: 'successful',
                        },
                    },
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
        paths: buildPaths(),
    },
    apis: [
        './src/routes/authRoutes.js',
        './src/routes/studentRoutes.js',
        './src/routes/adminRoutes.js',
        './src/routes/porterRoutes.js',
        './src/routes/paymentRoutes.js',
    ],
};
const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;
