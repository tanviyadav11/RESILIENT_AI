require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const sosRoutes = require('./routes/sosRoutes');
const shelterRoutes = require('./routes/shelterRoutes');
const authRoutes = require('./routes/authRoutes');
const disasterRoutes = require('./routes/disasterRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for dev
        methods: ["GET", "POST"]
    }
});

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make io available in routes
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/shelters', shelterRoutes);
app.use('/api/disasters', disasterRoutes);
app.use('/api/chat', chatRoutes);

// Socket.io Connection
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Join a chat room for specific SOS request
    socket.on('join-chat-room', (sosRequestId) => {
        socket.join(`sos-${sosRequestId}`);
        console.log(`Socket ${socket.id} joined room: sos-${sosRequestId}`);
    });

    // Leave a chat room
    socket.on('leave-chat-room', (sosRequestId) => {
        socket.leave(`sos-${sosRequestId}`);
        console.log(`Socket ${socket.id} left room: sos-${sosRequestId}`);
    });

    // Handle new message
    socket.on('send-message', (data) => {
        const { sosRequestId, message } = data;
        // Broadcast message to all in the room except sender
        socket.to(`sos-${sosRequestId}`).emit('new-message', message);
        console.log(`Message sent to room sos-${sosRequestId}`);
    });

    // Handle typing indicator
    socket.on('typing', (data) => {
        const { sosRequestId, userName, isTyping } = data;
        socket.to(`sos-${sosRequestId}`).emit('user-typing', { userName, isTyping });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Server Error', error: err.message });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
