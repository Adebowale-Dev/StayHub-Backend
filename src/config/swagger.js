const swaggerJsdoc = require('swagger-jsdoc');

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
  },
  apis: ['./src/routes/*.js'], // Path to the API routes
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
