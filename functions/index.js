const functions = require('firebase-functions/v1');
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
  .onRun(async () => {
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
          packageId: packageId,
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

// Create User Transfer (Server-side validation)
exports.createUserTransfer = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const senderId = context.auth.uid;
  const { recipientEmail, amount, note } = data;

  try {
    // Get feature config
    const configDoc = await db.collection('adminConfig').doc('features').get();
    const config = configDoc.exists ? configDoc.data() : {};
    
    if (!config.enableUserTransfers) {
      throw new functions.https.HttpsError('failed-precondition', 'User transfers are disabled');
    }

    // Validate amount
    if (!amount || amount < (config.transferMinAmount || 100)) {
      throw new functions.https.HttpsError('invalid-argument', `Minimum transfer is ${config.transferMinAmount || 100}`);
    }
    if (amount > (config.transferMaxAmount || 10000)) {
      throw new functions.https.HttpsError('invalid-argument', `Maximum transfer is ${config.transferMaxAmount || 10000}`);
    }

    // Get sender data
    const senderDoc = await db.collection('users').doc(senderId).get();
    if (!senderDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Sender not found');
    }
    const senderData = senderDoc.data();

    // Check sender eligibility
    if (senderData.status === 'blocked') {
      throw new functions.https.HttpsError('failed-precondition', 'Your account is blocked');
    }
    if (config.requireKycForTransfers && !senderData.kycVerified) {
      throw new functions.https.HttpsError('failed-precondition', 'KYC verification required');
    }
    if (config.requireEmailVerifiedForTransfers && !context.auth.emailVerified) {
      throw new functions.https.HttpsError('failed-precondition', 'Email verification required');
    }

    // Calculate fee
    const feeAmount = config.enableTransferFee ? (
      config.transferFeeType === 'percent' 
        ? (amount * (config.transferFeeValue || 0)) / 100
        : (config.transferFeeValue || 0)
    ) : 0;
    const totalDeduction = amount + feeAmount;

    // Check balance
    if (totalDeduction > (senderData.walletBalance || 0)) {
      throw new functions.https.HttpsError('failed-precondition', 'Insufficient balance');
    }

    // Find recipient
    const recipientQuery = await db.collection('users')
      .where('email', '==', recipientEmail.toLowerCase().trim())
      .get();
    
    if (recipientQuery.empty) {
      throw new functions.https.HttpsError('not-found', 'Recipient not found');
    }

    const recipientDoc = recipientQuery.docs[0];
    const recipientData = recipientDoc.data();
    const recipientId = recipientDoc.id;

    // Check self-transfer
    if (recipientId === senderId) {
      throw new functions.https.HttpsError('invalid-argument', 'Cannot transfer to yourself');
    }

    // Check recipient eligibility
    if (recipientData.status === 'blocked') {
      throw new functions.https.HttpsError('failed-precondition', 'Recipient account is blocked');
    }
    if (!config.enableTransferToUnverifiedUsers) {
      if (!context.auth.emailVerified) {
        throw new functions.https.HttpsError('failed-precondition', 'Recipient must have verified email');
      }
    }

    // Check cooldown
    if (config.transferCooldownMinutes) {
      const cooldownMs = config.transferCooldownMinutes * 60 * 1000;
      const recentTransfers = await db.collection('transfers')
        .where('senderUid', '==', senderId)
        .where('status', '==', 'completed')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      
      if (!recentTransfers.empty) {
        const lastTransfer = recentTransfers.docs[0].data();
        const lastTransferTime = lastTransfer.createdAt?.toDate?.() || new Date(lastTransfer.createdAt);
        const timeSince = Date.now() - lastTransferTime.getTime();
        if (timeSince < cooldownMs) {
          const remainingMinutes = Math.ceil((cooldownMs - timeSince) / 60000);
          throw new functions.https.HttpsError('resource-exhausted', `Please wait ${remainingMinutes} more minutes`);
        }
      }
    }

    // Check daily limit
    if (config.transferDailyLimit) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTransfers = await db.collection('transfers')
        .where('senderUid', '==', senderId)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
        .get();
      
      if (todayTransfers.size >= config.transferDailyLimit) {
        throw new functions.https.HttpsError('resource-exhausted', 'Daily transfer limit reached');
      }
    }

    // Create transfer record
    const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.collection('transfers').doc(transferId).set({
      senderUid: senderId,
      recipientUid: recipientId,
      senderEmailSnapshot: senderData.email,
      recipientEmailSnapshot: recipientEmail.toLowerCase().trim(),
      amount: amount,
      feeAmount: feeAmount,
      netAmount: amount,
      note: note || '',
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Deduct from sender
    await senderDoc.ref.update({
      walletBalance: admin.firestore.FieldValue.increment(-totalDeduction),
      lifetimeWithdrawn: admin.firestore.FieldValue.increment(totalDeduction)
    });

    // Credit recipient
    await recipientDoc.ref.update({
      walletBalance: admin.firestore.FieldValue.increment(amount),
      lifetimeEarned: admin.firestore.FieldValue.increment(amount)
    });

    // Create ledger entries
    const senderEntryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.collection('incomeLedger').doc(senderId).collection('entries').doc(senderEntryId).set({
      type: 'transfer_sent',
      amount: -totalDeduction,
      status: 'completed',
      description: `Transfer to ${recipientEmail}`,
      reference: transferId,
      metadata: { recipientUid: recipientId, feeAmount: feeAmount },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const recipientEntryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.collection('incomeLedger').doc(recipientId).collection('entries').doc(recipientEntryId).set({
      type: 'transfer_received',
      amount: amount,
      status: 'completed',
      description: `Transfer from ${senderData.email}`,
      reference: transferId,
      metadata: { senderUid: senderId },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Record fee if applicable
    if (feeAmount > 0) {
      // Add to platform wallet or admin revenue ledger
      const platformWalletRef = db.collection('wallets').doc('platform');
      const platformWallet = await platformWalletRef.get();
      if (platformWallet.exists) {
        await platformWalletRef.update({
          availableBalance: admin.firestore.FieldValue.increment(feeAmount)
        });
      } else {
        await platformWalletRef.set({
          availableBalance: feeAmount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    // Create audit log
    await db.collection('auditLogs').add({
      action: 'transfer_created',
      senderUid: senderId,
      recipientUid: recipientId,
      transferId: transferId,
      amount: amount,
      feeAmount: feeAmount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      performedBy: senderId
    });

    return { success: true, transferId };
  } catch (error) {
    console.error('Error creating transfer:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error creating transfer');
  }
});

// Create Sponsor Activation (Server-side validation)
exports.createSponsorActivation = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const sponsorId = context.auth.uid;
  const { targetUid, targetEmail, planId, amount } = data;

  try {
    // Get feature config
    const configDoc = await db.collection('adminConfig').doc('features').get();
    const config = configDoc.exists ? configDoc.data() : {};
    
    if (!config.enableSponsorActivation) {
      throw new functions.https.HttpsError('failed-precondition', 'Sponsor activation is disabled');
    }

    // Get sponsor data
    const sponsorDoc = await db.collection('users').doc(sponsorId).get();
    if (!sponsorDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Sponsor not found');
    }
    const sponsorData = sponsorDoc.data();

    // Check sponsor eligibility
    if (sponsorData.status === 'blocked') {
      throw new functions.https.HttpsError('failed-precondition', 'Your account is blocked');
    }

    // Get target user
    const targetDoc = await db.collection('users').doc(targetUid).get();
    if (!targetDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Target user not found');
    }
    const targetData = targetDoc.data();

    // Check target eligibility
    if (targetData.status === 'blocked') {
      throw new functions.https.HttpsError('failed-precondition', 'Target user account is blocked');
    }
    if (targetUid === sponsorId) {
      throw new functions.https.HttpsError('invalid-argument', 'Cannot activate your own account');
    }

    // Get package
    const packageDoc = await db.collection('packages').doc(planId).get();
    if (!packageDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Package not found');
    }
    const packageData = packageDoc.data();

    // Check if plan is allowed
    if (config.sponsorActivationAllowedPlans?.length > 0) {
      if (!config.sponsorActivationAllowedPlans.includes(planId)) {
        throw new functions.https.HttpsError('failed-precondition', 'This package is not allowed for sponsor activation');
      }
    }

    // Check minimum balance rule
    const minBalanceAfter = config.sponsorActivationMinBalanceRule || 0;
    const requiredBalance = amount + minBalanceAfter;
    if (requiredBalance > (sponsorData.walletBalance || 0)) {
      throw new functions.https.HttpsError('failed-precondition', `Insufficient balance. Required: ${requiredBalance}`);
    }

    // Check daily limits
    if (config.sponsorActivationDailyLimit) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayActivations = await db.collection('activations')
        .where('sponsorUid', '==', sponsorId)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
        .get();
      
      if (todayActivations.size >= config.sponsorActivationDailyLimit) {
        throw new functions.https.HttpsError('resource-exhausted', 'Daily activation limit reached');
      }
    }

    if (config.sponsorActivationDailyAmountLimit) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayActivations = await db.collection('activations')
        .where('sponsorUid', '==', sponsorId)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
        .get();
      
      const todayTotal = todayActivations.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
      if (todayTotal + amount > config.sponsorActivationDailyAmountLimit) {
        throw new functions.https.HttpsError('resource-exhausted', 'Daily activation amount limit reached');
      }
    }

    // Check if target already has this package active
    const existingPackage = await db.collection('userPackages')
      .where('userId', '==', targetUid)
      .where('packageId', '==', planId)
      .where('status', '==', 'active')
      .get();
    
    if (!existingPackage.empty) {
      throw new functions.https.HttpsError('failed-precondition', 'Target user already has this package active');
    }

    // Create activation record
    const activationId = `activation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.collection('activations').doc(activationId).set({
      sponsorUid: sponsorId,
      targetUid: targetUid,
      sponsorEmailSnapshot: sponsorData.email,
      targetEmailSnapshot: targetEmail || targetData.email,
      planId: planId,
      planName: packageData.name,
      amount: amount,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Deduct from sponsor
    await sponsorDoc.ref.update({
      walletBalance: admin.firestore.FieldValue.increment(-amount),
      lifetimeWithdrawn: admin.firestore.FieldValue.increment(amount)
    });

    // Create user package for target
    const userPackageId = `${targetUid}_${planId}_${Date.now()}`;
    await db.collection('userPackages').doc(userPackageId).set({
      userId: targetUid,
      packageId: planId,
      packageName: packageData.name,
      amount: amount,
      currency: 'INR',
      status: 'active',
      activatedAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentMethod: 'sponsor_activation',
      sponsorUid: sponsorId,
      activationId: activationId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create ledger entries
    const sponsorEntryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.collection('incomeLedger').doc(sponsorId).collection('entries').doc(sponsorEntryId).set({
      type: 'activation_paid',
      amount: -amount,
      status: 'completed',
      description: `Activated ${packageData.name} for ${targetEmail || targetData.email}`,
      reference: activationId,
      metadata: { targetUid: targetUid, planId: planId },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const targetEntryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.collection('incomeLedger').doc(targetUid).collection('entries').doc(targetEntryId).set({
      type: 'activation_received',
      amount: 0, // No wallet credit, just package activation
      status: 'completed',
      description: `Package ${packageData.name} activated by sponsor`,
      reference: activationId,
      metadata: { sponsorUid: sponsorId, planId: planId },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create audit log
    await db.collection('auditLogs').add({
      action: 'sponsor_activation_created',
      sponsorUid: sponsorId,
      targetUid: targetUid,
      activationId: activationId,
      planId: planId,
      amount: amount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      performedBy: sponsorId
    });

    return { success: true, activationId, userPackageId };
  } catch (error) {
    console.error('Error creating activation:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error creating activation');
  }
});

// Validate Referral Code (Public - for signup flow)
exports.validateReferralCode = functions.https.onCall(async (data, context) => {
  try {
    const { refCode } = data;
    
    if (!refCode || typeof refCode !== 'string' || refCode.trim().length < 4) {
      return {
        valid: false,
        error: 'Invalid referral code format'
      };
    }
    
    const normalizedCode = refCode.toUpperCase().trim();
    
    // Query users collection for referral code
    const usersSnapshot = await db.collection('users')
      .where('refCode', '==', normalizedCode)
      .limit(1)
      .get();
    
    if (usersSnapshot.empty) {
      return {
        valid: false,
        error: 'Referral code not found'
      };
    }
    
    const userDoc = usersSnapshot.docs[0].data();
    
    // Check if user is blocked
    if (userDoc.status === 'blocked') {
      return {
        valid: false,
        error: 'Referral code belongs to a blocked account'
      };
    }
    
    // Return success (don't expose full user data)
    return {
      valid: true,
      error: null
    };
  } catch (error) {
    console.error('Error validating referral code:', error);
    return {
      valid: false,
      error: 'Error validating referral code'
    };
  }
});

