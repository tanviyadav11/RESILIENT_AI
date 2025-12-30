const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const connectDB = async () => {
    try {
        console.log("Attempting to connect to MongoDB...");

        // Start In-Memory MongoDB
        const mongod = await MongoMemoryServer.create();
        const mongoUri = mongod.getUri();

        console.log(`In-Memory MongoDB started at ${mongoUri}`);

        const conn = await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
