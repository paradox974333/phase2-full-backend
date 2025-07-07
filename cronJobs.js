// cronJobs.js
const cron = require('node-cron');
const User = require('./user');
const { processReferralReward } = require('./referral');
const { getWalletBalance, sendTRX } = require('./tronWalletUtils');
const { notifyAdminOfError } = require('./errorNotifier');

// CORRECTED: Run every day at 00:00 (midnight) to distribute daily rewards
cron.schedule('0 0 * * *', async () => {
  console.log('🕐 Running daily stake rewards distribution...');
  try {
    const users = await User.find({ 'stakes.status': 'active' });
    for (const user of users) {
      let userUpdated = false;
      const now = new Date();

      for (const stake of user.stakes) {
        if (stake.status === 'active') {
          const lastRewardDate = new Date(stake.lastRewardDate);
          // Calculate the number of full days that have passed since the last reward
          const daysSinceLastReward = Math.floor((now - lastRewardDate) / (24 * 60 * 60 * 1000));
          
          if (daysSinceLastReward >= 1) {
            const daysRemaining = stake.duration - stake.daysPaid;
            const daysToPay = Math.min(daysSinceLastReward, daysRemaining);

            if (daysToPay > 0) {
              // --- NEW DAILY REWARD LOGIC ---
              const rewardToCredit = stake.dailyReward * daysToPay;
              user.credits = (user.credits || 0) + rewardToCredit;
              user.creditsHistory.push({
                type: 'reward',
                amount: rewardToCredit,
                reason: `Daily staking reward for ${stake.planName}`,
                date: new Date()
              });
              
              stake.daysPaid += daysToPay;
              // Advance the last reward date by the number of days paid
              stake.lastRewardDate = new Date(lastRewardDate.getTime() + daysToPay * 24 * 60 * 60 * 1000);
              console.log(`- User ${user.username}, Stake ${stake.planName}: Paid ${rewardToCredit} daily reward credits. Progress: ${stake.daysPaid}/${stake.duration}`);
              userUpdated = true;
            }
            
            // Check if stake is now completed after the daily payment
            if (stake.daysPaid >= stake.duration) {
              stake.status = 'completed';
              // --- CORRECTED: ONLY RETURN THE PRINCIPAL, AS REWARDS ARE ALREADY PAID DAILY ---
              const principalToReturn = stake.amount; 
              user.credits = (user.credits || 0) + principalToReturn;
              user.creditsHistory.push({ 
                  type: 'stake', 
                  amount: principalToReturn, 
                  reason: `Completed stake principal returned for ${stake.planName}`,
                  date: new Date()
              });
              console.log(`✅ Stake completed for user ${user.username}: ${stake.planName}. Returned principal of ${principalToReturn} credits.`);
              
              // Process referral reward based on the original stake amount upon completion
              processReferralReward(user._id, stake.amount);
              userUpdated = true;
            }
          }
        }
      }
      if (userUpdated) await user.save();
    }
  } catch (error) {
    console.error('❌ Error in daily rewards distribution:', error);
    await notifyAdminOfError('Daily Rewards Cron Job Failed', error);
  }
});

// Run every minute to check for user deposits and sweep funds (No changes needed here)
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
    
    const users = await User.find({ isActive: true }).select('+privateKey +walletAddress +username +credits +creditsHistory');
    if (!users.length) {
        isDepositJobRunning = false;
        return;
    }

    const MIN_DEPOSIT_TRX = 1.0;
    const TRX_FEE_BUFFER = 1.1; // A safe buffer for transaction fees

    for (const user of users) {
      try {
        const balance = await getWalletBalance(user.walletAddress);

        if (balance >= MIN_DEPOSIT_TRX) {
          console.log(`💰 Deposit of ${balance} TRX found for user ${user.username}. Attempting sweep...`);
          
          const amountToSweep = balance - TRX_FEE_BUFFER;

          if (amountToSweep > 0) {
            // --- SECURE LOGIC: SWEEP FIRST, CREDIT LATER ---
            try {
              const result = await sendTRX(user.walletAddress, user.privateKey, ADMIN_WALLET_ADDRESS, amountToSweep);
              
              if (result.success) {
                console.log(`🧹 Swept ${amountToSweep} TRX from ${user.username} to admin. Tx: ${result.txHash}`);
                
                user.credits = (user.credits || 0) + balance;
                user.creditsHistory.push({ type: 'deposit', amount: balance, reason: `TRX deposit detected and secured` });
                await user.save();
                console.log(`✅ User ${user.username} credited with ${balance} credits.`);
              } else {
                throw new Error(`Sweep failed for user ${user.username} with 'success: false'`);
              }

            } catch (sweepError) {
              console.error(`Sweep failed for ${user.username}, credits were NOT given. Manual action may be required.`);
              await notifyAdminOfError('Deposit Sweep Failed', sweepError, `User: ${user.username}, Balance: ${balance} TRX. NO credits were given.`);
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