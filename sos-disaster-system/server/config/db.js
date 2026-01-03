const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        console.log("Attempting to connect to MongoDB...");

        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sos-disaster-system';

        console.log(`Connecting to: ${mongoUri}`);

        const conn = await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Database Connection Error: ${error.message}`);
        console.log("Please ensure MongoDB is running or MONGO_URI is correct.");
        process.exit(1);
    }
};

module.exports = connectDB;
