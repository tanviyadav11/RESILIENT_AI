const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
        expiresIn: '30d',
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = async (req, res) => {
    try {
        let { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.status(400).json({ message: 'Please provide email/mobile and password' });
        }

        identifier = identifier.trim().toLowerCase();

        // Check if identifier is email or mobile
        const user = await User.findOne({
            $or: [{ email: identifier }, { mobile: identifier }]
        });

        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                role: user.role,
                token: generateToken(user._id),
            });
        } else {
            res.status(401).json({ message: 'Invalid email/mobile or password' });
        }
    } catch (error) {
        console.error('=== Login Error ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ message: 'Server error during login', error: error.message });
    }
};

// @desc    Register a new user (Admin only in real app, public for demo)
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    try {
        console.log('=== Registration Request ===');
        console.log('Data:', req.body);

        let { name, email, mobile, password, role } = req.body;

        if (email) email = email.trim().toLowerCase();
        if (mobile) mobile = mobile.trim();

        const query = [];
        if (email) query.push({ email });
        if (mobile) query.push({ mobile });

        const userExists = query.length > 0 ? await User.findOne({ $or: query }) : null;

        if (userExists) {
            // If user already exists, try to log them in automatically if password matches
            const isMatch = await userExists.matchPassword(password);

            if (isMatch) {
                console.log('User already exists, logging in automatically:', email);
                return res.status(200).json({
                    _id: userExists._id,
                    name: userExists.name,
                    email: userExists.email,
                    mobile: userExists.mobile,
                    role: userExists.role,
                    token: generateToken(userExists._id),
                    message: 'Logged in automatically'
                });
            } else {
                console.log('User already exists but password mismatch:', email);
                res.status(400).json({ message: 'User already exists with different credentials' });
                return;
            }
        }

        // Validate role
        const allowedRoles = ['citizen', 'authority', 'admin'];
        const userRole = role && allowedRoles.includes(role) ? role : 'citizen';

        const user = await User.create({
            name,
            email,
            mobile,
            password,
            role: userRole,
        });

        if (user) {
            console.log('User created successfully:', user._id);
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user._id),
            });
        } else {
            console.log('User creation failed');
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error('=== Registration Error ===');
        console.error('Error:', error.message);
        console.error('Error name:', error.name);
        console.error('Stack:', error.stack);

        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            console.error('Validation errors:', messages);
            res.status(400).json({
                message: 'Validation failed: ' + messages.join(', '),
                error: error.message
            });
        } else if (error.code === 11000) {
            // Duplicate key error
            console.error('Duplicate key error:', error.keyPattern);
            res.status(400).json({
                message: 'User with this email or mobile already exists',
                error: error.message
            });
        } else {
            res.status(500).json({
                message: 'Server error during registration. Check server logs for details.',
                error: error.message
            });
        }
    }
};

module.exports = { authUser, registerUser };
