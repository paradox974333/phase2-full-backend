// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');
const authenticate = require('./authMiddleware');
require('./cronJobs');


// Load environment variables from .env file
dotenv.config();

// Import the User model and the wallet utility functions
const User = require('./user');
const { generateTronWallet } = require('./tronWalletUtils');

// Initialize Express application
const app = express();

// Security middleware
app.use(helmet()); // Security headers
app.use(cors()); // Allows requests from different origins

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Registration rate limiting (more restrictive)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 registration attempts per hour
  message: 'Too many registration attempts from this IP, please try again later.'
});

// Body parser middleware
app.use(express.json({ limit: '10mb' }));

// Helper function to get client IP
function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
}

// Helper function to validate password strength
function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (password.length < minLength || !hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
    return { valid: false, message: 'Password must be at least 8 characters long and include uppercase, lowercase, numbers, and special characters.' };
  }
  return { valid: true };
}

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

// Basic root route
app.get('/', (req, res) => {
  res.send('🚀 TRON Wallet API is live');
});

// API Endpoint: Register new user
app.post('/register', registerLimiter, async (req, res) => {
  const { username, email, password, agreeToTerms, referralCode } = req.body;
  const clientIp = getClientIp(req);

  try {
    if (!username || !email || !password || !agreeToTerms) {
      return res.status(400).json({ error: 'Username, email, password, and terms agreement are required' });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    let referrerId = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode: referralCode.toUpperCase().trim() });
      if (referrer) {
        referrerId = referrer._id;
      }
    }

    const { address, encryptedPrivateKey } = await generateTronWallet();

    const user = new User({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password,
      walletAddress: address,
      privateKey: encryptedPrivateKey,
      registrationIp: clientIp,
      lastLoginIp: clientIp,
      referredBy: referrerId
    });
    user.addIpToHistory(clientIp, 'registration');
    await user.save();

    res.status(201).json({
      message: '✅ Account created successfully!',
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// API Endpoint: User login
app.post('/login', async (req, res) => {
  const { identifier, password } = req.body;
  const clientIp = getClientIp(req);

  try {
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/username and password are required' });
    }
    const user = await User.findByEmailOrUsername(identifier);
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    user.lastLogin = new Date();
    user.lastLoginIp = clientIp;
    user.loginCount += 1;
    user.addIpToHistory(clientIp, 'login');
    await user.save();

    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: '✅ Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        isAdmin: user.isAdmin // Include isAdmin flag in login response
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// --- ROUTE REGISTRATION ---

// Import all route files
const profileRoutes = require('./profile');
const stakingRoutes = require('./staking');
const withdrawalRoutes = require('./withdrawal');
const { router: referralRoutes } = require('./referral');
const historyRoutes = require('./history.js');
const kycRoutes = require('./kyc.js');
const adminRoutes = require('./admin.js');

// Standard user-facing routes
app.use('/api', profileRoutes);
app.use('/api', stakingRoutes);
app.use('/api', withdrawalRoutes);
app.use('/api', referralRoutes);
app.use('/api', historyRoutes);
app.use('/api', kycRoutes);

// Admin-specific routes
app.use('/api/admin', adminRoutes);

// REMOVED: Insecure static serving of KYC documents. This is the critical security fix.
// app.use('/uploads/kyc', express.static('uploads/kyc'));


// Define the port the server will listen on
const PORT = process.env.PORT || 5000;

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});