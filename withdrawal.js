// withdrawal.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const authenticate = require('./authMiddleware');
const User = require('./user');
const { isValidTronAddress } = require('./tronWalletUtils');
const { notifyAdminOfError } = require('./errorNotifier');

// GET /withdrawal/balance - Get available balance for withdrawal
router.get('/withdrawal/balance', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // With the new daily payout logic, all credits in the main `user.credits` balance
    // are available for withdrawal. The principal of an active stake is the only
    // amount that is locked, and it has already been deducted from this balance.
    res.json({
      message: '✅ Balance fetched successfully',
      totalCredits: user.credits || 0,
      availableForWithdrawal: user.credits || 0
    });
  } catch (err) {
    console.error('Withdrawal balance error:', err);
    res.status(500).json({ error: 'Internal server error fetching balance' });
  }
});

// CORRECTED: Request withdrawal (queues for manual admin processing)
router.post('/withdrawal/request', authenticate, async (req, res) => {
  const { withdrawalAddress, amount } = req.body;

  try {
    const parsedAmount = parseFloat(amount);
    if (!withdrawalAddress || !parsedAmount) {
      return res.status(400).json({ error: 'Withdrawal address and a valid amount are required' });
    }
    if (!isValidTronAddress(withdrawalAddress)) {
      return res.status(400).json({ error: 'Invalid TRON address format' });
    }
    if (parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Ensure user has passed KYC if it's required for withdrawals
    if (!user.kycApproved) {
        return res.status(403).json({ error: 'KYC approval is required before making a withdrawal.' });
    }

    const availableForWithdrawal = user.credits || 0;

    if (parsedAmount > availableForWithdrawal) {
      return res.status(400).json({ 
        error: `Insufficient balance. Available for withdrawal: ${availableForWithdrawal} credits`,
        availableBalance: availableForWithdrawal
      });
    }

    // --- SECURE QUEUING LOGIC ---

    // 1. Debit the user's credits immediately to prevent double-spending
    user.credits -= parsedAmount;

    // 2. Create the withdrawal record with a 'pending' status
    if (!user.withdrawals) user.withdrawals = [];
    const withdrawal = {
      id: crypto.randomBytes(16).toString('hex'), // More robust unique ID
      amount: parsedAmount,
      withdrawalAddress,
      status: 'pending', // IMPORTANT: Marked as pending for admin processing
      requestDate: new Date(),
    };
    user.withdrawals.push(withdrawal);

    // 3. Add to credits history
    user.creditsHistory.push({
      type: 'withdrawal',
      amount: -parsedAmount,
      reason: `Withdrawal request to ${withdrawalAddress}`,
      date: new Date()
    });

    await user.save();

    // 4. Notify the admin about the new withdrawal request
    await notifyAdminOfError(
      'New Withdrawal Request',
      new Error(`A new withdrawal has been requested and is awaiting approval.`),
      `User: ${user.username} (${user._id})\nAmount: ${parsedAmount} TRX\nTo Address: ${withdrawalAddress}`
    );

    // 5. Respond to the user
    res.status(202).json({
      message: '✅ Withdrawal request received and is being processed. This may take up to 24 hours.',
      withdrawal,
      newCreditBalance: user.credits,
    });

  } catch (err) {
    console.error('Withdrawal request error:', err);
    res.status(500).json({ error: 'Internal server error processing withdrawal. Please contact support.' });
  }
});


// GET /withdrawal/history - Get withdrawal history
router.get('/withdrawal/history', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const withdrawals = user.withdrawals || [];
    
    res.json({
      message: '✅ Withdrawal history fetched successfully',
      withdrawals: withdrawals.sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate))
    });
  } catch (err) {
    console.error('Withdrawal history error:', err);
    res.status(500).json({ error: 'Internal server error fetching withdrawal history' });
  }
});

module.exports = router;