const mongoose = require('mongoose');

const maskMongoUri = (uri) => uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');

const isLocalMongoUri = (uri = '') => /mongodb(\+srv)?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(uri);

const shouldRetryWithFallbackUri = (error) => {
    const message = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    return message.includes('querysrv') || message.includes('enotfound') || code === 'econnrefused' || code === 'enotfound' || code === 'invalid_mongodb_uri';
};

const getMongoUriCandidates = () => {
    const candidates = [];
    if (process.env.MONGODB_URI) {
        candidates.push({ label: 'MONGODB_URI', uri: process.env.MONGODB_URI });
    }
    if (process.env.MONGODB_URI_DIRECT) {
        candidates.push({ label: 'MONGODB_URI_DIRECT', uri: process.env.MONGODB_URI_DIRECT });
    }
    return candidates;
};

const connectDB = async () => {
    try {
        const candidates = getMongoUriCandidates();
        if (candidates.length === 0) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }
        console.log('Attempting to connect to MongoDB...');
        console.log(`MongoDB URI candidates detected: ${candidates.map((item) => item.label).join(', ')}`);
        let conn;
        let lastError;

        for (let index = 0; index < candidates.length; index += 1) {
            const candidate = candidates[index];
            try {
                if (index > 0) {
                    console.log(`Retrying DB connection with ${candidate.label}...`);
                }

                if (process.env.NODE_ENV === 'production' && isLocalMongoUri(candidate.uri)) {
                    const uriError = new Error(`${candidate.label} is set to localhost/127.0.0.1 in production`);
                    uriError.code = 'INVALID_MONGODB_URI';
                    throw uriError;
                }

                console.log('Connection string:', maskMongoUri(candidate.uri));
                conn = await mongoose.connect(candidate.uri, {
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
                break;
            }
            catch (error) {
                lastError = error;
                const canFallback = index < candidates.length - 1 && shouldRetryWithFallbackUri(error);
                if (canFallback) {
                    console.warn(`${candidate.label} failed (${error.code || 'unknown'}). Trying fallback URI...`);
                    continue;
                }
                throw error;
            }
        }

        if (!conn && lastError) {
            throw lastError;
        }

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
        if (String(error?.code || '').toLowerCase() === 'invalid_mongodb_uri') {
            console.error('\nProduction MongoDB URI is invalid for cloud deployment.');
            console.error('Set Render environment variable MONGODB_URI (or MONGODB_URI_DIRECT) to your Atlas URI.');
            console.error('Do not use localhost or 127.0.0.1 on Render.');
        }
        process.exit(1);
    }
};
module.exports = connectDB;
