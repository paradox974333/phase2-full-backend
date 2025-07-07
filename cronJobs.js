// cronJobs.js
const cron = require('node-cron');
const User = require('./user');
const { processReferralReward } = require('./referral');
const { getWalletBalance, sendTRX } = require('./tronWalletUtils');
const { notifyAdminOfError } = require('./errorNotifier');

// Run every day at 00:00 (midnight) for daily rewards
cron.schedule('0 0 * * *', async () => {
  console.log('🕐 Running daily rewards distribution...');
  try {
    const users = await User.find({ 'stakes.status': 'active' });
    for (const user of users) {
      let userUpdated = false;
      const now = new Date();
      if (!user.credits) user.credits = 0;

      user.stakes.forEach(stake => {
        if (stake.status === 'active') {
          const lastRewardDate = new Date(stake.lastRewardDate);
          const daysSinceLastReward = Math.floor((now - lastRewardDate) / (24 * 60 * 60 * 1000));
          if (daysSinceLastReward >= 1) {
            const daysRemaining = stake.duration - stake.daysPaid;
            const daysToPay = Math.min(daysSinceLastReward, daysRemaining);
            if (daysToPay > 0) {
              const rewardToAdd = daysToPay * stake.dailyReward;
              user.credits += rewardToAdd;
              stake.daysPaid += daysToPay;
              stake.lastRewardDate = new Date(lastRewardDate.getTime() + daysToPay * 24 * 60 * 60 * 1000);
              user.creditsHistory.push({ type: 'reward', amount: rewardToAdd, reason: `Daily reward for ${stake.planName}` });
              userUpdated = true;
              console.log(`💰 User ${user.username}: +${rewardToAdd} credits`);
            }
            if (stake.daysPaid >= stake.duration) {
              stake.status = 'completed';
              console.log(`✅ Stake completed for user ${user.username}: ${stake.planName}`);
              processReferralReward(user._id, stake.amount);
              userUpdated = true;
            }
          }
        }
      });
      if (userUpdated) await user.save();
    }
  } catch (error) {
    console.error('❌ Error in daily rewards distribution:', error);
    await notifyAdminOfError('Daily Rewards Cron Job Failed', error);
  }
});

// Run every minute to check for user deposits and sweep funds
let isDepositJobRunning = false;
cron.schedule('* * * * *', async () => {
  if (isDepositJobRunning) return;
  isDepositJobRunning = true;
  console.log('🔍 Running deposit check...');
  
  try {
    const ADMIN_WALLET_ADDRESS = process.env.ADMIN_WALLET_ADDRESS;
    if (!ADMIN_WALLET_ADDRESS) {
      console.error('❌ ADMIN_WALLET_ADDRESS is not set. Deposit check cannot run.');
      isDepositJobRunning = false;
      return;
    }
    
    const users = await User.find({ isActive: true }).select('+privateKey');
    if (!users.length) {
        isDepositJobRunning = false;
        return;
    }

    const MIN_DEPOSIT_TRX = 1.0;
    const TRX_FEE_BUFFER = 0.1; // A safe buffer of 0.1 TRX for the transaction fee

    for (const user of users) {
      try {
        const balance = await getWalletBalance(user.walletAddress);

        if (balance >= MIN_DEPOSIT_TRX) {
          console.log(`💰 Deposit of ${balance} TRX found for user ${user.username}.`);
          
          const amountToSweep = balance - TRX_FEE_BUFFER;

          if (amountToSweep > 0) {
            user.credits = (user.credits || 0) + balance;
            user.creditsHistory.push({ type: 'deposit', amount: balance, reason: `TRX deposit detected in user wallet` });

            const result = await sendTRX(user.walletAddress, user.privateKey, ADMIN_WALLET_ADDRESS, amountToSweep);

            if (result.success) {
              console.log(`🧹 Swept ${amountToSweep} TRX from ${user.username} to admin. Tx: ${result.txHash}`);
              await user.save();
            } else {
              await user.save(); // Save the credit addition even if sweep fails
              const sweepFailError = new Error(`Sweep failed, but credits were given. Manual transfer required.`);
              console.error(sweepFailError.message);
              await notifyAdminOfError('Deposit Sweep Failed', sweepFailError, `User: ${user.username}, Balance: ${balance} TRX`);
            }
          }
        }
      } catch (userError) {
        console.error(`Error checking deposit for user ${user.username}: ${userError.message}`);
      }
    }
  } catch (error) {
    console.error('❌ Critical error in deposit checking cron job:', error);
    await notifyAdminOfError('Deposit Check Cron Job Failed', error);
  } finally {
    isDepositJobRunning = false;
  }
});

console.log('📅 Cron jobs initialized.');