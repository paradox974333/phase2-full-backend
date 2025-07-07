// walletMonitor.js
const express = require('express');
const router = express.Router();
const authenticate = require('./authMiddleware');
const User = require('./user');
const { getWalletBalance, sendTRX } = require('./tronWalletUtils');

const ADMIN_WALLET_ADDRESS = process.env.ADMIN_WALLET_ADDRESS;

if (!ADMIN_WALLET_ADDRESS) {
  console.error('❌ ADMIN_WALLET_ADDRESS is not set in .env');
  process.exit(1);
}

// POST /wallet/check-deposit
// Detect deposit in user wallet, credit user, and sweep to admin wallet
router.post('/wallet/check-deposit', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const balance = await getWalletBalance(user.walletAddress);
    const MIN_DEPOSIT = 1; // TRX

    if (balance < MIN_DEPOSIT) {
      return res.status(400).json({
        message: `No deposit found. Current balance: ${balance} TRX`
      });
    }

    // Add virtual credits
    user.credits = (user.credits || 0) + balance;

    // Sweep to admin wallet
    const result = await sendTRX(
      user.walletAddress,
      user.privateKey, // already encrypted
      ADMIN_WALLET_ADDRESS,
      balance
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Sweep to admin wallet failed' });
    }

    await user.save();

    res.json({
      message: `✅ ${balance} TRX received and credited as virtual credits`,
      credits: user.credits,
      txHash: result.txHash
    });
  } catch (err) {
    console.error('Deposit check error:', err);
    res.status(500).json({ error: 'Internal error checking wallet balance' });
  }
});

module.exports = router;
