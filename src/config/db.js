const mongoose = require('mongoose');
const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }
        console.log('Attempting to connect to MongoDB...');
        console.log('Connection string:', process.env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: 10,
            minPoolSize: 2,
            socketTimeoutMS: 45000,
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
            w: 'majority',
            wtimeoutMS: 30000,
            autoIndex: process.env.NODE_ENV !== 'production',
            family: 4,
        });
        console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
        console.log(`✓ Database: ${conn.connection.name}`);
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });
        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('MongoDB connection closed due to app termination');
            process.exit(0);
        });
    }
    catch (error) {
        console.error('\n❌ MongoDB Connection Failed:');
        console.error('Error:', error.message);
        if (error.message.includes('ENOTFOUND') || error.message.includes('querySrv')) {
            console.error('\nPossible causes:');
            console.error('1. MongoDB Atlas cluster does not exist or is paused');
            console.error('2. Network/DNS resolution issues');
            console.error('3. Incorrect cluster hostname in connection string');
            console.error('\nSolutions:');
            console.error('- Check if your MongoDB Atlas cluster is active at https://cloud.mongodb.com');
            console.error('- Verify your connection string is correct');
            console.error('- Check your internet connection');
            console.error('- Try using the standard connection string (without +srv) from MongoDB Atlas');
        }
        process.exit(1);
    }
};
module.exports = connectDB;
