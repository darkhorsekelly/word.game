import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

// Load .env variables
dotenv.config();

const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;

if (!mongoUri) {
    throw new Error('MONGODB_URI env variable not set.');
}

if (!dbName) {
    throw new Error('DB_NAME env variable not set.');
}

let dbInstance: Db | null = null;
let clientInstance: MongoClient | null = null;

async function connectToDb(): Promise<Db> {
    if (dbInstance) {
        // Already connected - return existing instance
        return dbInstance;
    }
    try {
        console.log('Connecting to MongoDB...');
        clientInstance = new MongoClient(mongoUri!);
        await clientInstance.connect();
        dbInstance = clientInstance.db(dbName);
        console.log('Successfully connceted to MongoDB database:', dbName);
        return dbInstance;
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}

function getDb(): Db {
    if (!dbInstance) {
        throw new Error('Database not initialized. Call connect');
    }
    return dbInstance;
}

async function closeDbConnection(): Promise<void> {
    if (clientInstance) {
        await clientInstance.close();
        console.log('MongoDB connection closed.');
        dbInstance = null;
        clientInstance = null;
    }
}

process.on('SIGINT', async () => {
    await closeDbConnection();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    await closeDbConnection();
    process.exit(0);
});


export { connectToDb, getDb, closeDbConnection };