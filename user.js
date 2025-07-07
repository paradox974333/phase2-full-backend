// user.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  // Basic user information
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },

  // Wallet information
  walletAddress: {
    type: String,
    required: true,
    unique: true
  },
  privateKey: {
    type: String,
    required: true
  },

  // KYC and verification
  kycApproved: {
    type: Boolean,
    default: false
  },
  kycStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'not_submitted'],
    default: 'not_submitted'
  },
  kycDocuments: [{
    path: String,
    filename: String,
    documentType: {
      type: String,
      enum: ['id_front', 'id_back', 'selfie']
    },
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],

  // IP tracking
  registrationIp: {
    type: String,
    required: true
  },
  lastLoginIp: String,
  ipHistory: [{
    ip: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    action: {
      type: String,
      enum: ['registration', 'login', 'transaction', 'other']
    }
  }],

  // Credits & staking
  credits: {
    type: Number,
    default: 0
  },
  stakes: [{
    planId: String,
    planName: String,
    amount: Number,
    reward: Number,
    duration: Number,
    dailyReward: Number,
    daysPaid: Number,
    lastRewardDate: Date,
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active'
    }
  }],

  // Credits history tracking
  creditsHistory: [{
    type: {
      type: String,
      enum: ['deposit', 'reward', 'referral', 'withdrawal', 'stake', 'admin_adjustment']
    },
    amount: Number,
    reason: String,
    date: {
      type: Date,
      default: Date.now
    }
  }],

  // Withdrawals
  withdrawals: [{
    id: String,
    amount: Number,
    withdrawalAddress: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },
    requestDate: Date,
    processedDate: Date,
    txHash: String
  }],

  // Referrals
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  referralEarnings: {
    type: Number,
    default: 0
  },

  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date,

  // Login tracking
  lastLogin: Date,
  loginCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const hashed = await bcrypt.hash(this.password, 12);
    this.password = hashed;
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Track IP history
userSchema.methods.addIpToHistory = function (ip, action = 'other') {
  this.ipHistory.push({ ip, action, timestamp: new Date() });
  if (this.ipHistory.length > 50) {
    this.ipHistory = this.ipHistory.slice(-50);
  }
};

// Find by email or username
userSchema.statics.findByEmailOrUsername = function (identifier) {
  return this.findOne({
    $or: [{ email: identifier.toLowerCase() }, { username: identifier }]
  });
};

module.exports = mongoose.model('User', userSchema);