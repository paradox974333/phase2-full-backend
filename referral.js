// referral.js
const express = require('express');
const router = express.Router();
const authenticate = require('./authMiddleware');
const User = require('./user');
const crypto = require('crypto');

// Generate unique referral code
function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// GET /referral/code - Get user's referral code
router.get('/referral/code', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.referralCode) {
      let referralCode;
      let isUnique = false;
      while (!isUnique) {
        referralCode = generateReferralCode();
        const existingUser = await User.findOne({ referralCode });
        if (!existingUser) {
          isUnique = true;
        }
      }
      user.referralCode = referralCode;
      await user.save();
    }

    res.json({
      message: '✅ Referral code retrieved successfully',
      referralCode: user.referralCode,
      referralEarnings: user.referralEarnings || 0
    });
  } catch (err) {
    console.error('Referral code error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /referral/stats - Get referral statistics
router.get('/referral/stats', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const totalReferrals = await User.countDocuments({ referredBy: user._id });
    const recentReferrals = await User.find({ referredBy: user._id })
      .select('username createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      message: '✅ Referral stats fetched successfully',
      referralCode: user.referralCode,
      totalReferrals,
      totalEarnings: user.referralEarnings || 0,
      recentReferrals
    });
  } catch (err) {
    console.error('Referral stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Internal function to process referral reward
async function processReferralReward(userId, stakeAmount) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.referredBy) return;

    const referrer = await User.findById(user.referredBy);
    if (!referrer) return;

    const rewardAmount = stakeAmount * 0.1;
    referrer.credits = (referrer.credits || 0) + rewardAmount;
    referrer.referralEarnings = (referrer.referralEarnings || 0) + rewardAmount;
    referrer.creditsHistory.push({
        type: 'referral',
        amount: rewardAmount,
        reason: `Referral bonus from ${user.username}'s completed stake`,
    });
    await referrer.save();

    console.log(`💰 Referral reward: ${rewardAmount} credits added to ${referrer.username}`);
  } catch (err) {
    console.error('Referral reward processing error:', err);
  }
}

module.exports = {
  router,
  processReferralReward
};