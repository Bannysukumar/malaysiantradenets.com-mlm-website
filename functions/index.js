const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Helper function to get income rules
async function getIncomeRules() {
  const rulesDoc = await db.collection('incomeRules').doc('main').get();
  return rulesDoc.exists ? rulesDoc.data() : {
    withSecurity: { dailyPercent: 2, maxWorkingDays: 60, minPackageInr: 50000 },
    withoutSecurity: { dailyPercent: 1.5, maxWorkingDays: 60 }
  };
}

// Helper function to get marketing config
async function getMarketingConfig() {
  const configDoc = await db.collection('marketingConfig').doc('main').get();
  return configDoc.exists ? configDoc.data() : {
    directReferralPercent: 5,
    levelPercentages: [
      { levelFrom: 1, levelTo: 5, percent: 5 },
      { levelFrom: 6, levelTo: 10, percent: 4 },
      { levelFrom: 11, levelTo: 15, percent: 3 },
      { levelFrom: 16, levelTo: 20, percent: 2 },
      { levelFrom: 21, levelTo: 25, percent: 1 }
    ]
  };
}

// Helper function to get terms config
async function getTermsConfig() {
  const termsDoc = await db.collection('terms').doc('main').get();
  return termsDoc.exists ? termsDoc.data() : { adminChargesPercent: 10 };
}

// Helper function to check if date is a working day (Monday-Friday)
function isWorkingDay(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5; // Monday = 1, Friday = 5
}

// Helper function to get upline chain
async function getUplineChain(userId) {
  const chain = [];
  let currentUserId = userId;
  
  while (currentUserId) {
    const userDoc = await db.collection('users').doc(currentUserId).get();
    if (!userDoc.exists) break;
    
    const userData = userDoc.data();
    if (userData.referredBy) {
      chain.push(userData.referredBy);
      currentUserId = userData.referredBy;
    } else {
      break;
    }
  }
  
  return chain;
}

// Helper function to update user wallet
async function updateUserWallet(userId, amount, type, description, metadata = {}) {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    throw new Error(`User ${userId} not found`);
  }
  
  const currentBalance = userDoc.data().walletBalance || 0;
  const currentIncome = userDoc.data().totalIncome || 0;
  const newBalance = currentBalance + amount;
  const newIncome = currentIncome + amount;
  
  await userRef.update({
    walletBalance: newBalance,
    totalIncome: newIncome,
    lastIncomeUpdate: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Create transaction record
  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await db.collection('transactions').doc(transactionId).set({
    userId: userId,
    amount: amount,
    type: type,
    description: description,
    status: 'completed',
    walletBalanceBefore: currentBalance,
    walletBalanceAfter: newBalance,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...metadata
  });
  
  return { newBalance, transactionId };
}

// Daily ROI Distribution - Runs every day at 9 AM UTC
exports.distributeDailyROI = functions.pubsub.schedule('0 9 * * 1-5')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('Starting daily ROI distribution...');
    
    try {
      const incomeRules = await getIncomeRules();
      const today = new Date();
      
      if (!isWorkingDay(today)) {
        console.log('Today is not a working day. Skipping ROI distribution.');
        return null;
      }
      
      // Get all active packages
      const activePackagesSnapshot = await db.collection('userPackages')
        .where('status', '==', 'active')
        .get();
      
      if (activePackagesSnapshot.empty) {
        console.log('No active packages found.');
        return null;
      }
      
      let processedCount = 0;
      let totalDistributed = 0;
      
      for (const packageDoc of activePackagesSnapshot.docs) {
        const pkg = { id: packageDoc.id, ...packageDoc.data() };
        
        // Check if package has exceeded max working days
        const activatedAt = pkg.activatedAt?.toDate();
        if (!activatedAt) continue;
        
        const daysSinceActivation = Math.floor((today - activatedAt) / (1000 * 60 * 60 * 24));
        const workingDays = pkg.workingDaysProcessed || 0;
        
        // Determine which rule to use
        const useSecurity = pkg.amount >= (incomeRules.withSecurity?.minPackageInr || 50000);
        const rule = useSecurity ? incomeRules.withSecurity : incomeRules.withoutSecurity;
        
        if (workingDays >= (rule.maxWorkingDays || 60)) {
          console.log(`Package ${pkg.id} has reached max working days. Skipping.`);
          continue;
        }
        
        // Calculate daily ROI
        const dailyROI = (pkg.amount * (rule.dailyPercent || 2)) / 100;
        
        // Update package working days
        await packageDoc.ref.update({
          workingDaysProcessed: workingDays + 1,
          lastROIDistribution: admin.firestore.FieldValue.serverTimestamp(),
          totalROIEarned: (pkg.totalROIEarned || 0) + dailyROI
        });
        
        // Update user wallet
        await updateUserWallet(
          pkg.userId,
          dailyROI,
          'daily_roi',
          `Daily ROI for ${pkg.packageName}`,
          {
            packageId: pkg.id,
            packageName: pkg.packageName,
            dailyPercent: rule.dailyPercent,
            workingDay: workingDays + 1
          }
        );
        
        processedCount++;
        totalDistributed += dailyROI;
      }
      
      console.log(`Daily ROI distribution completed. Processed ${processedCount} packages. Total distributed: ${totalDistributed}`);
      return { processedCount, totalDistributed };
      
    } catch (error) {
      console.error('Error in daily ROI distribution:', error);
      throw error;
    }
  });

// Referral Commission Distribution - Triggers when package is activated
exports.distributeReferralCommission = functions.firestore
  .document('userPackages/{packageId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Only process when status changes from pending to active
    if (before.status !== 'pending' || after.status !== 'active') {
      return null;
    }
    
    console.log(`Processing referral commission for package ${context.params.packageId}`);
    
    try {
      const marketingConfig = await getMarketingConfig();
      const userId = after.userId;
      
      // Get user's referrer
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists || !userDoc.data().referredBy) {
        console.log(`User ${userId} has no referrer. Skipping referral commission.`);
        return null;
      }
      
      const referrerId = userDoc.data().referredBy;
      
      // Calculate direct referral commission
      const directPercent = marketingConfig.directReferralPercent || 5;
      const commission = (after.amount * directPercent) / 100;
      
      // Update referrer's wallet
      await updateUserWallet(
        referrerId,
        commission,
        'direct_referral',
        `Direct referral commission from ${userDoc.data().name || 'User'}`,
        {
          referredUserId: userId,
          packageId: context.params.packageId,
          packageName: after.packageName,
          packageAmount: after.amount,
          commissionPercent: directPercent
        }
      );
      
      // Update referrer's direct referrals count
      const referrerRef = db.collection('users').doc(referrerId);
      const referrerDoc = await referrerRef.get();
      const currentCount = referrerDoc.data().directReferrals || 0;
      await referrerRef.update({
        directReferrals: currentCount + 1
      });
      
      // Distribute level income
      await distributeLevelIncome(userId, after.amount, after.packageName, context.params.packageId);
      
      console.log(`Referral commission distributed: ${commission} to ${referrerId}`);
      return null;
      
    } catch (error) {
      console.error('Error in referral commission distribution:', error);
      throw error;
    }
  });

// Level Income Distribution
async function distributeLevelIncome(userId, packageAmount, packageName, packageId) {
  try {
    const marketingConfig = await getMarketingConfig();
    const levelPercentages = marketingConfig.levelPercentages || [];
    
    // Get upline chain
    const uplineChain = await getUplineChain(userId);
    
    if (uplineChain.length === 0) {
      console.log(`No upline chain for user ${userId}`);
      return;
    }
    
    // Distribute level income
    for (let level = 0; level < uplineChain.length && level < 25; level++) {
      const uplineId = uplineChain[level];
      const actualLevel = level + 1; // Level 1, 2, 3, etc.
      
      // Find matching level percentage
      let levelPercent = 0;
      for (const levelConfig of levelPercentages) {
        if (actualLevel >= levelConfig.levelFrom && actualLevel <= levelConfig.levelTo) {
          levelPercent = levelConfig.percent;
          break;
        }
      }
      
      if (levelPercent === 0) {
        continue; // No commission for this level
      }
      
      // Calculate level income
      const levelIncome = (packageAmount * levelPercent) / 100;
      
      // Update upline wallet
      await updateUserWallet(
        uplineId,
        levelIncome,
        'level_income',
        `Level ${actualLevel} income from ${packageName}`,
        {
          level: actualLevel,
          downlineUserId: userId,
          packageId: packageId,
          packageName: packageName,
          packageAmount: packageAmount,
          levelPercent: levelPercent
        }
      );
      
      console.log(`Level ${actualLevel} income distributed: ${levelIncome} to ${uplineId}`);
    }
    
  } catch (error) {
    console.error('Error in level income distribution:', error);
    throw error;
  }
}

// Weekly Payout Processing - Runs every Monday at 9 AM UTC
exports.processWeeklyPayouts = functions.pubsub.schedule('0 9 * * 1')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('Starting weekly payout processing...');
    
    try {
      const termsConfig = await getTermsConfig();
      const adminChargesPercent = termsConfig.adminChargesPercent || 10;
      
      // Get all users with wallet balance > 0
      const usersSnapshot = await db.collection('users')
        .where('walletBalance', '>', 0)
        .get();
      
      if (usersSnapshot.empty) {
        console.log('No users with wallet balance found.');
        return null;
      }
      
      let processedCount = 0;
      let totalPayouts = 0;
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const walletBalance = userData.walletBalance || 0;
        
        if (walletBalance <= 0) continue;
        
        // Calculate admin charges
        const adminCharges = (walletBalance * adminChargesPercent) / 100;
        const payoutAmount = walletBalance - adminCharges;
        
        // Create payout record
        const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.collection('payouts').doc(payoutId).set({
          userId: userDoc.id,
          walletBalanceBefore: walletBalance,
          payoutAmount: payoutAmount,
          adminCharges: adminCharges,
          adminChargesPercent: adminChargesPercent,
          status: 'pending', // Admin needs to process manually
          requestedAt: admin.firestore.FieldValue.serverTimestamp(),
          week: context.timestamp
        });
        
        // Reset wallet balance (amount moved to pending payout)
        await userDoc.ref.update({
          walletBalance: 0,
          pendingPayout: payoutAmount,
          lastPayoutRequest: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Create transaction record
        const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.collection('transactions').doc(transactionId).set({
          userId: userDoc.id,
          amount: -walletBalance,
          type: 'payout_request',
          description: `Weekly payout request (Admin charges: ${adminChargesPercent}%)`,
          status: 'pending',
          payoutId: payoutId,
          adminCharges: adminCharges,
          payoutAmount: payoutAmount,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        processedCount++;
        totalPayouts += payoutAmount;
      }
      
      console.log(`Weekly payout processing completed. Processed ${processedCount} users. Total payouts: ${totalPayouts}`);
      return { processedCount, totalPayouts };
      
    } catch (error) {
      console.error('Error in weekly payout processing:', error);
      throw error;
    }
  });

// Manual trigger function for testing daily ROI
exports.manualDailyROI = functions.https.onRequest(async (req, res) => {
  try {
    // Import the logic from distributeDailyROI
    const incomeRules = await getIncomeRules();
    const today = new Date();
    
    if (!isWorkingDay(today)) {
      return res.json({ success: true, message: 'Today is not a working day' });
    }
    
    const activePackagesSnapshot = await db.collection('userPackages')
      .where('status', '==', 'active')
      .get();
    
    if (activePackagesSnapshot.empty) {
      return res.json({ success: true, message: 'No active packages found' });
    }
    
    let processedCount = 0;
    let totalDistributed = 0;
    
    for (const packageDoc of activePackagesSnapshot.docs) {
      const pkg = { id: packageDoc.id, ...packageDoc.data() };
      const activatedAt = pkg.activatedAt?.toDate();
      if (!activatedAt) continue;
      
      const workingDays = pkg.workingDaysProcessed || 0;
      const useSecurity = pkg.amount >= (incomeRules.withSecurity?.minPackageInr || 50000);
      const rule = useSecurity ? incomeRules.withSecurity : incomeRules.withoutSecurity;
      
      if (workingDays >= (rule.maxWorkingDays || 60)) continue;
      
      const dailyROI = (pkg.amount * (rule.dailyPercent || 2)) / 100;
      
      await packageDoc.ref.update({
        workingDaysProcessed: workingDays + 1,
        lastROIDistribution: admin.firestore.FieldValue.serverTimestamp(),
        totalROIEarned: (pkg.totalROIEarned || 0) + dailyROI
      });
      
      await updateUserWallet(
        pkg.userId,
        dailyROI,
        'daily_roi',
        `Daily ROI for ${pkg.packageName}`,
        {
          packageId: pkg.id,
          packageName: pkg.packageName,
          dailyPercent: rule.dailyPercent,
          workingDay: workingDays + 1
        }
      );
      
      processedCount++;
      totalDistributed += dailyROI;
    }
    
    res.json({ success: true, processedCount, totalDistributed });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create Withdrawal Request (Server-side validation)
exports.createWithdrawalRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;
  const { amount, method, payoutDetails } = data;

  try {
    // Get withdrawal config
    const configDoc = await db.collection('adminConfig').doc('withdrawals').get();
    const config = configDoc.exists ? configDoc.data() : {
      minWithdrawal: 400,
      maxWithdrawal: 100000,
      feePercent: 10,
      allowedMethods: ['bank', 'upi'],
      requireKyc: false,
      requireBankVerified: true,
      maxWithdrawalsPerDay: 3,
      cooldownHours: 24
    };

    // Validate amount
    if (!amount || amount < config.minWithdrawal) {
      throw new functions.https.HttpsError('invalid-argument', `Minimum withdrawal is ${config.minWithdrawal}`);
    }
    if (amount > config.maxWithdrawal) {
      throw new functions.https.HttpsError('invalid-argument', `Maximum withdrawal is ${config.maxWithdrawal}`);
    }

    // Check if method is allowed
    if (!config.allowedMethods?.includes(method)) {
      throw new functions.https.HttpsError('invalid-argument', 'Withdrawal method not allowed');
    }

    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }
    const userData = userDoc.data();

    // Check wallet balance
    if (amount > (userData.walletBalance || 0)) {
      throw new functions.https.HttpsError('failed-precondition', 'Insufficient balance');
    }

    // Check KYC requirement
    if (config.requireKyc && !userData.kycVerified) {
      throw new functions.https.HttpsError('failed-precondition', 'KYC verification required');
    }

    // Check bank verification requirement
    if (method === 'bank' && config.requireBankVerified) {
      const financialProfile = await db.collection('userFinancialProfiles').doc(userId).get();
      if (!financialProfile.exists || !financialProfile.data()?.bank?.isVerified) {
        throw new functions.https.HttpsError('failed-precondition', 'Bank details must be verified');
      }
    }

    // Check for pending withdrawals
    const pendingQuery = await db.collection('withdrawals')
      .where('uid', '==', userId)
      .where('status', 'in', ['requested', 'under_review', 'approved'])
      .get();
    
    if (!pendingQuery.empty) {
      throw new functions.https.HttpsError('failed-precondition', 'You have a pending withdrawal request');
    }

    // Check daily withdrawal limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayQuery = await db.collection('withdrawals')
      .where('uid', '==', userId)
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
      .get();
    
    if (todayQuery.size >= (config.maxWithdrawalsPerDay || 3)) {
      throw new functions.https.HttpsError('resource-exhausted', 'Daily withdrawal limit reached');
    }

    // Calculate fees
    const feeAmount = (amount * (config.feePercent || 10)) / 100;
    const netAmount = amount - feeAmount;

    // Create withdrawal request
    const withdrawalId = `wd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.collection('withdrawals').doc(withdrawalId).set({
      uid: userId,
      withdrawalId: withdrawalId,
      amountRequested: amount,
      feeAmount: feeAmount,
      netAmount: netAmount,
      method: method,
      payoutDetailsSnapshot: payoutDetails,
      status: 'requested',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Deduct from wallet (move to pending)
    await userDoc.ref.update({
      walletBalance: admin.firestore.FieldValue.increment(-amount),
      pendingBalance: admin.firestore.FieldValue.increment(amount)
    });

    // Create audit log
    await db.collection('auditLogs').add({
      action: 'withdrawal_request_created',
      userId: userId,
      withdrawalId: withdrawalId,
      amount: amount,
      method: method,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      performedBy: userId
    });

    return { success: true, withdrawalId };
  } catch (error) {
    console.error('Error creating withdrawal request:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error creating withdrawal request');
  }
});

// Adjust User Wallet (Admin only)
exports.adjustUserWallet = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if user is admin (should verify via custom claims or Firestore)
  const adminDoc = await db.collection('users').doc(context.auth.uid).get();
  const userRole = adminDoc.data()?.role;
  if (userRole !== 'admin' && userRole !== 'superAdmin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const { userId, amount, type, description, adminNote } = data;

  try {
    if (!userId || !amount || !description) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const currentBalance = userDoc.data().walletBalance || 0;
    const newBalance = currentBalance + amount;

    // Update wallet
    await userRef.update({
      walletBalance: newBalance,
      totalIncome: admin.firestore.FieldValue.increment(amount > 0 ? amount : 0),
      lifetimeEarned: admin.firestore.FieldValue.increment(amount > 0 ? amount : 0)
    });

    // Create income ledger entry
    const entryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.collection('incomeLedger').doc(userId).collection('entries').doc(entryId).set({
      type: type || 'admin_adjust',
      amount: amount,
      status: 'approved',
      description: description,
      reference: `admin_adjust_${Date.now()}`,
      metadata: {
        adminNote: adminNote || '',
        adjustedBy: context.auth.uid,
        balanceBefore: currentBalance,
        balanceAfter: newBalance
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create transaction record
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.collection('transactions').doc(transactionId).set({
      userId: userId,
      amount: amount,
      type: type || 'admin_adjust',
      description: description,
      status: 'completed',
      walletBalanceBefore: currentBalance,
      walletBalanceAfter: newBalance,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        adminNote: adminNote || '',
        adjustedBy: context.auth.uid
      }
    });

    // Create audit log
    await db.collection('auditLogs').add({
      action: 'wallet_adjusted',
      userId: userId,
      amount: amount,
      type: type,
      description: description,
      adminNote: adminNote || '',
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      performedBy: context.auth.uid
    });

    return { success: true, newBalance };
  } catch (error) {
    console.error('Error adjusting wallet:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error adjusting wallet');
  }
});

