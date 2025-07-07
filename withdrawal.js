// withdrawal.js
const express = require('express');
const router = express.Router();
const authenticate = require('./authMiddleware');
const User = require('./user');
const { sendTRX, isValidTronAddress } = require('./tronWalletUtils');
const { notifyAdminOfError } = require('./errorNotifier');

// GET /withdrawal/balance - Get available balance for withdrawal
router.get('/withdrawal/balance', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const totalCredits = user.credits || 0;
    let lockedCredits = 0;

    if (user.stakes && user.stakes.length > 0) {
      user.stakes.forEach(stake => {
        if (stake.status === 'active') {
          lockedCredits += stake.amount;
        }
      });
    }

    res.json({
      message: '✅ Balance fetched successfully',
      totalCredits: totalCredits,
      lockedCredits,
      availableForWithdrawal: Math.max(0, totalCredits - lockedCredits)
    });
  } catch (err) {
    console.error('Withdrawal balance error:', err);
    res.status(500).json({ error: 'Internal server error fetching balance' });
  }
});

// POST /withdrawal/request - Request withdrawal
router.post('/withdrawal/request', authenticate, async (req, res) => {
  const { withdrawalAddress, amount } = req.body;

  try {
    if (!withdrawalAddress || !amount) {
      return res.status(400).json({ error: 'Withdrawal address and amount are required' });
    }
    if (!isValidTronAddress(withdrawalAddress)) {
      return res.status(400).json({ error: 'Invalid TRON address format' });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const totalCredits = user.credits || 0;
    let lockedCredits = 0;
    if (user.stakes && user.stakes.length > 0) {
      user.stakes.forEach(stake => {
        if (stake.status === 'active') {
          lockedCredits += stake.amount;
        }
      });
    }

    const availableForWithdrawal = Math.max(0, totalCredits - lockedCredits);

    if (amount > availableForWithdrawal) {
      return res.status(400).json({ 
        error: `Insufficient balance. Available for withdrawal: ${availableForWithdrawal} credits`,
        availableBalance: availableForWithdrawal
      });
    }

    if (!user.withdrawals) user.withdrawals = [];
    
    const withdrawal = {
      id: Date.now().toString(),
      amount,
      withdrawalAddress,
      status: 'pending',
      requestDate: new Date(),
    };
    user.withdrawals.push(withdrawal);
    await user.save();

    try {
      const result = await sendTRX(
        process.env.ADMIN_WALLET_ADDRESS,
        process.env.ADMIN_ENCRYPTED_PRIVATE_KEY,
        withdrawalAddress,
        amount
      );

      if (result.success) {
        const wIndex = user.withdrawals.findIndex(w => w.id === withdrawal.id);
        if (wIndex > -1) {
            user.withdrawals[wIndex].status = 'completed';
            user.withdrawals[wIndex].processedDate = new Date();
            user.withdrawals[wIndex].txHash = result.txHash;
        }

        user.credits -= amount;
        user.creditsHistory.push({
            type: 'withdrawal',
            amount: -amount,
            reason: `Withdrawal to address ${withdrawalAddress}`,
            date: new Date()
        });
        await user.save();

        res.json({
          message: '✅ Withdrawal completed successfully',
          withdrawal: user.withdrawals[wIndex],
        });
      } else {
        throw new Error('sendTRX returned success:false without throwing an error.');
      }
    } catch (txError) {
      await notifyAdminOfError(
        'Withdrawal Transaction Failed',
        txError,
        `User: ${user.username} (${user._id}), Amount: ${amount} TRX, To: ${withdrawalAddress}`
      );

      const wIndex = user.withdrawals.findIndex(w => w.id === withdrawal.id);
      if (wIndex > -1) {
          user.withdrawals[wIndex].status = 'failed';
      }
      await user.save();

      res.status(500).json({ 
        error: 'Withdrawal processing failed. Please contact support.',
        withdrawal: user.withdrawals[wIndex]
      });
    }
  } catch (err) {
    console.error('Withdrawal request error:', err);
    res.status(500).json({ error: 'Internal server error processing withdrawal' });
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