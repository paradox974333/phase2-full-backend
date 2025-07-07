// admin.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const adminAuthenticate = require('./adminAuthMiddleware');
const User = require('./user');
const { getWalletBalance } = require('./tronWalletUtils');
const fs = require('fs');
const path = require('path');

// Apply the admin authentication middleware to all routes in this file
router.use(adminAuthenticate);

// GET /api/admin/stats - Get platform-wide statistics
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const kycPending = await User.countDocuments({ kycStatus: 'pending' });
    const withdrawalPending = await User.countDocuments({ 'withdrawals.status': 'pending' });

    const creditStats = await User.aggregate([
      { $group: { _id: null, totalCredits: { $sum: '$credits' } } },
    ]);
    
    const stakeStats = await User.aggregate([
        { $unwind: '$stakes' },
        { $match: { 'stakes.status': 'active' } },
        { $group: { _id: null, totalStaked: { $sum: '$stakes.amount' } } }
    ]);

    const adminWalletBalance = await getWalletBalance(process.env.ADMIN_WALLET_ADDRESS);

    res.json({
      totalUsers,
      kycPending,
      withdrawalPending,
      totalCreditsInSystem: creditStats[0]?.totalCredits || 0,
      totalActivelyStaked: stakeStats[0]?.totalStaked || 0,
      adminWalletBalance,
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// GET /api/admin/users - Get a paginated list of all users
router.get('/users', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  try {
    const users = await User.find({})
      .select('-password -privateKey -ipHistory') // Exclude heavy/sensitive fields
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await User.countDocuments();
    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Admin fetch users error:", err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/admin/users/:userId/credits - Manually adjust a user's credits
router.post('/users/:userId/credits', async (req, res) => {
  const { amount, reason } = req.body;
  if (typeof amount !== 'number' || !reason) {
    return res.status(400).json({ error: 'Amount (number) and reason (string) are required.' });
  }

  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.credits += amount;
    user.creditsHistory.push({
      type: 'admin_adjustment',
      amount,
      reason: `Admin adjustment by ${req.user.username}: ${reason}`,
      date: new Date(),
    });
    await user.save();
    res.json({ message: 'Credits adjusted successfully.', newBalance: user.credits });
  } catch (err) {
    console.error("Admin credit adjust error:", err);
    res.status(500).json({ error: 'Failed to adjust credits' });
  }
});

// GET /api/admin/kyc/pending - Get users with pending KYC
router.get('/kyc/pending', async (req, res) => {
  try {
    const users = await User.find({ kycStatus: 'pending' }).select('username email kycStatus kycDocuments createdAt');
    res.json(users);
  } catch (err) {
    console.error("Admin fetch pending KYC error:", err);
    res.status(500).json({ error: 'Failed to fetch pending KYC submissions' });
  }
});

// POST /api/admin/kyc/:userId/approve - Approve a user's KYC
router.post('/kyc/:userId/approve', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { kycStatus: 'approved', kycApproved: true },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'KYC approved.', user: { id: user.id, kycStatus: user.kycStatus } });
  } catch (err) {
    console.error("Admin approve KYC error:", err);
    res.status(500).json({ error: 'Failed to approve KYC' });
  }
});

// POST /api/admin/kyc/:userId/reject - Reject a user's KYC
router.post('/kyc/:userId/reject', async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.userId,
        { kycStatus: 'rejected', kycApproved: false },
        { new: true }
      );
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ message: 'KYC rejected.', user: { id: user.id, kycStatus: user.kycStatus } });
    } catch (err) {
      console.error("Admin reject KYC error:", err);
      res.status(500).json({ error: 'Failed to reject KYC' });
    }
  });


// *** NEW SECURE ENDPOINT FOR VIEWING KYC DOCUMENTS ***
// GET /api/admin/kyc/document/:filename - Securely serves a KYC document
router.get('/kyc/document/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    // Security: Prevent path traversal attacks
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    // Since this route is already protected by adminAuthenticate, we know the user is an admin.
    // NOTE: This path assumes your `uploads` directory is at the root of your project.
    // Adjust '../' if your file structure is different.
    const filePath = path.join(process.cwd(), 'uploads/kyc', filename);

    if (fs.existsSync(filePath)) {
      // Stream the file to the client
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'Document not found' });
    }
  } catch (err) {
    console.error("Admin fetch KYC doc error:", err);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});


module.exports = router;