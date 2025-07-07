// staking.js
const express = require('express');
const router = express.Router();
const authenticate = require('./authMiddleware');
const User = require('./user');

// Define fixed staking plans
const STAKING_PLANS = [
  { id: 'quick', name: 'Quick Stake', duration: 7, minCredits: 50, rewardPercent: 100 },
  { id: 'standard', name: 'Standard Stake', duration: 30, minCredits: 100, rewardPercent: 250 },
  { id: 'premium', name: 'Premium Stake', duration: 90, minCredits: 500, rewardPercent: 500 },
  { id: 'elite', name: 'Elite Stake', duration: 180, minCredits: 1000, rewardPercent: 1000 }
];

// POST /staking/plan
router.post('/staking/plan', authenticate, async (req, res) => {
  const { planId, amount } = req.body;

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const plan = STAKING_PLANS.find(p => p.id === planId);
    if (!plan) return res.status(400).json({ error: 'Invalid staking plan' });

    if (!amount || amount < plan.minCredits) {
      return res.status(400).json({ error: `Minimum ${plan.minCredits} credits required for this plan` });
    }

    if (user.credits < amount) {
      return res.status(400).json({ error: `Insufficient credits. Available: ${user.credits}` });
    }

    user.credits -= amount;

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + plan.duration * 24 * 60 * 60 * 1000);
    const totalReward = amount * (plan.rewardPercent / 100);
    
    // CORRECTED: Calculate the daily reward amount and store it
    const dailyReward = totalReward / plan.duration;

    user.stakes.push({
      planId: plan.id,
      planName: plan.name,
      amount,
      reward: totalReward,
      duration: plan.duration,
      dailyReward, // Store this for the daily cron job
      daysPaid: 0,
      lastRewardDate: startDate,
      startDate,
      endDate,
      status: 'active'
    });

    user.creditsHistory.push({
      type: 'stake',
      amount: -amount,
      reason: `Staked in ${plan.name} plan`,
    });

    await user.save();

    res.json({
      message: `✅ Successfully staked ${amount} credits in ${plan.name}`,
      stake: user.stakes[user.stakes.length - 1]
    });
  } catch (err) {
    console.error('Staking error:', err);
    res.status(500).json({ error: 'Internal server error during staking' });
  }
});

// GET /staking/status
router.get('/staking/status', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      message: '✅ Stake status fetched',
      credits: user.credits,
      stakes: user.stakes
    });
  } catch (err) {
    console.error('Status fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;