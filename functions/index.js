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

// Helper function to get renewal config
async function getRenewalConfig() {
  const configDoc = await db.collection('adminConfig').doc('renewals').get();
  return configDoc.exists ? configDoc.data() : {
    enableIdRenewalRule: false,
    defaultCapMultiplier: 3.0,
    capAction: 'STOP_EARNINGS',
    // Include ALL income types for Investors
    eligibleIncomeTypes: ['daily_roi', 'REFERRAL_DIRECT', 'REFERRAL_LEVEL', 'direct_referral', 'level_income', 'bonus', 'achievement_level_income'],
    graceLimitInr: 0,
    autoMarkCapReached: true,
    renewalRequiredMessage: 'You reached 3× cap. Renew ID to continue earning.',
    allowRenewSamePlan: true,
    allowRenewUpgrade: true,
    renewalOptions: {
      adminCanRenew: true,
      userCanRequestRenewal: true,
      sponsorCanRenew: false,
      walletCanPayRenewal: true,
      paymentGatewayRenewal: true
    },
    renewalFeePercent: 0,
    requireKycForRenewal: false,
    requireBankVerifiedForWithdrawalsAfterRenewal: false
  };
}

// Helper function to get active package for user
async function getActivePackage(userId) {
  const packagesSnapshot = await db.collection('userPackages')
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  
  if (packagesSnapshot.empty) return null;
  
  const pkg = packagesSnapshot.docs[0];
  return { id: pkg.id, ...pkg.data() };
}

// Helper function to get or create earning cap tracker
async function getEarningCap(userId, cycleNumber) {
  const capDoc = await db.collection('earningCaps').doc(`${userId}_${cycleNumber}`).get();
  
  if (capDoc.exists) {
    return { id: capDoc.id, ...capDoc.data() };
  }
  
  // Get active package to initialize cap
  const activePackage = await getActivePackage(userId);
  if (!activePackage) return null;
  
  // Get user's program type to determine correct multiplier
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.exists ? userDoc.data() : {};
  const programType = userData.programType || 'investor';
  
  // Get program-specific multiplier
  const programConfig = await db.collection('adminConfig').doc('programs').get();
  const programConfigData = programConfig.exists ? programConfig.data() : {};
  
  let multiplier;
  if (programType === 'leader') {
    // For Leaders, use leaderCapMultiplier (default 3.0) and leaderBaseAmount
    multiplier = programConfigData.leaderCapMultiplier || 3.0;
    const leaderBaseAmount = programConfigData.leaderBaseAmount || 1000;
    const renewalConfig = await getRenewalConfig();
    const baseAmount = leaderBaseAmount; // Use leader base amount, not package price
    const capAmount = baseAmount * multiplier;
    
    const newCap = {
      uid: userId,
      cycleNumber: cycleNumber,
      eligibleEarningsTotalInr: 0,
      eligibleEarningsTotalUsd: 0,
      capAmountInr: capAmount,
      remainingInr: capAmount,
      capStatus: 'ACTIVE',
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('earningCaps').doc(`${userId}_${cycleNumber}`).set(newCap);
    return { id: `${userId}_${cycleNumber}`, ...newCap };
  } else {
    // For Investors, use investorCapMultiplier (default 2.0) and package price
    multiplier = programConfigData.investorCapMultiplier || 2.0;
  }
  
  const renewalConfig = await getRenewalConfig();
  const baseAmount = activePackage.baseAmountInr || activePackage.amount || 0;
  // Use package's stored multiplier if exists, otherwise use program-specific multiplier
  const finalMultiplier = activePackage.capMultiplier || multiplier || renewalConfig.defaultCapMultiplier || 2.0;
  const capAmount = baseAmount * finalMultiplier;
  
  const newCap = {
    uid: userId,
    cycleNumber: cycleNumber,
    eligibleEarningsTotalInr: 0,
    eligibleEarningsTotalUsd: 0,
    capAmountInr: capAmount,
    remainingInr: capAmount,
    capStatus: 'ACTIVE',
    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  await db.collection('earningCaps').doc(`${userId}_${cycleNumber}`).set(newCap);
  return { id: `${userId}_${cycleNumber}`, ...newCap };
}

// Helper function to evaluate and update cap
async function evaluateCap(userId, incomeAmount, incomeType, metadata = {}) {
  const renewalConfig = await getRenewalConfig();
  
  // If renewal rule is disabled, skip cap evaluation
  if (!renewalConfig.enableIdRenewalRule) {
    return { allowed: true, reason: 'Renewal rule disabled' };
  }
  
  // For referral income (both direct and level), check if it counts toward cap
  if (incomeType === 'REFERRAL_DIRECT' || incomeType === 'REFERRAL_LEVEL') {
    const referralConfig = await db.collection('adminConfig').doc('referralIncome').get();
    const refConfig = referralConfig.exists ? referralConfig.data() : {};
    
    // If referral income doesn't count toward cap, skip evaluation
    // For Investors: ALL income types count toward cap (including referral)
    // But still respect the setting if explicitly disabled
    if (!refConfig.referralIncomeCountsTowardCap && !metadata.countsTowardCap) {
      // For Investors, we want all incomes to count, so only skip if explicitly set to false
      // This allows admin to control it, but defaults to counting for Investors
      return { allowed: true, reason: 'Referral income does not count toward cap' };
    }
  }
  
  // Check if income type is eligible
  // Support both 'REFERRAL_DIRECT' and 'direct_referral' for backward compatibility
  // Also support REFERRAL_LEVEL for multi-level income
  const isEligible = renewalConfig.eligibleIncomeTypes?.includes(incomeType) ||
    (incomeType === 'REFERRAL_DIRECT' && renewalConfig.eligibleIncomeTypes?.includes('direct_referral')) ||
    (incomeType === 'direct_referral' && renewalConfig.eligibleIncomeTypes?.includes('REFERRAL_DIRECT')) ||
    (incomeType === 'REFERRAL_LEVEL' && (renewalConfig.eligibleIncomeTypes?.includes('REFERRAL_DIRECT') || 
                                         renewalConfig.eligibleIncomeTypes?.includes('direct_referral') ||
                                         renewalConfig.eligibleIncomeTypes?.includes('REFERRAL_LEVEL')));
  
  if (!isEligible) {
    return { allowed: true, reason: 'Income type not eligible for cap' };
  }
  
  // Get active package
  const activePackage = await getActivePackage(userId);
  if (!activePackage) {
    return { allowed: true, reason: 'No active package' };
  }
  
  // Check package status
  if (activePackage.capStatus === 'CAP_REACHED' || activePackage.capStatus === 'RENEWAL_PENDING') {
    if (renewalConfig.capAction === 'STOP_EARNINGS' || renewalConfig.capAction === 'STOP_BOTH') {
      return { 
        allowed: false, 
        reason: 'Cap reached - earnings stopped',
        capStatus: activePackage.capStatus
      };
    }
  }
  
  // Get or create earning cap tracker
  const cycleNumber = activePackage.cycleNumber || 1;
  const capTracker = await getEarningCap(userId, cycleNumber);
  if (!capTracker) {
    return { allowed: true, reason: 'No cap tracker found' };
  }
  
  // Update earnings total
  const newEarningsTotal = (capTracker.eligibleEarningsTotalInr || 0) + incomeAmount;
  const remaining = Math.max(0, capTracker.capAmountInr - newEarningsTotal);
  
  // Check if cap is reached
  const capReached = newEarningsTotal >= capTracker.capAmountInr;
  const graceLimit = renewalConfig.graceLimitInr || 0;
  const overCap = newEarningsTotal > capTracker.capAmountInr;
  const withinGrace = overCap && (newEarningsTotal - capTracker.capAmountInr) <= graceLimit;
  
  // Update cap tracker
  await db.collection('earningCaps').doc(capTracker.id).update({
    eligibleEarningsTotalInr: newEarningsTotal,
    remainingInr: remaining,
    capStatus: capReached ? 'CAP_REACHED' : 'ACTIVE',
    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // If cap reached and auto-mark enabled, update package status
  if (capReached && renewalConfig.autoMarkCapReached && activePackage.capStatus !== 'CAP_REACHED') {
    await db.collection('userPackages').doc(activePackage.id).update({
      capStatus: 'CAP_REACHED',
      capReachedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  
  // Determine if income should be allowed
  if (capReached && !withinGrace) {
    if (renewalConfig.capAction === 'STOP_EARNINGS' || renewalConfig.capAction === 'STOP_BOTH') {
      return { 
        allowed: false, 
        reason: 'Cap reached - earnings stopped',
        capStatus: 'CAP_REACHED',
        earningsTotal: newEarningsTotal,
        capAmount: capTracker.capAmountInr
      };
    }
  }
  
  return { 
    allowed: true, 
    reason: capReached ? 'Cap reached but within grace limit' : 'Within cap',
    capStatus: capReached ? 'CAP_REACHED' : 'ACTIVE',
    earningsTotal: newEarningsTotal,
    remaining: remaining,
    capAmount: capTracker.capAmountInr
  };
}

// Helper function to check if date is a working day (Monday-Friday)
function isWorkingDay(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5; // Monday = 1, Friday = 5
}

// Helper function to get upline chain (using referredByUid)
async function getUplineChain(userId, maxLevels = 25) {
  const chain = [];
  let currentUserId = userId;
  let level = 0;
  
  while (currentUserId && level < maxLevels) {
    const userDoc = await db.collection('users').doc(currentUserId).get();
    if (!userDoc.exists) break;
    
    const userData = userDoc.data();
    if (userData.referredByUid) {
      chain.push({
        uid: userData.referredByUid,
        level: level + 1
      });
      currentUserId = userData.referredByUid;
      level++;
    } else {
      break;
    }
  }
  
  return chain;
}

// Helper function to get level percentage for a given level
function getLevelPercentage(level, levelPercentages) {
  if (!levelPercentages || levelPercentages.length === 0) {
    return 0; // No multi-level income if not configured
  }
  
  // Find the matching level range
  for (const range of levelPercentages) {
    if (level >= range.levelFrom && level <= range.levelTo) {
      return range.percent || 0;
    }
  }
  
  return 0; // No percentage for this level
}

// Helper function to update user wallet (with cap check)
async function updateUserWallet(userId, amount, type, description, metadata = {}, skipCapCheck = false) {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    throw new Error(`User ${userId} not found`);
  }
  
  // Check cap before crediting (only for eligible income types)
  if (!skipCapCheck && amount > 0) {
    const capResult = await evaluateCap(userId, amount, type, metadata);
    
    if (!capResult.allowed) {
      // Create ledger entry marked as rejected due to cap
      const ledgerEntryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.collection('incomeLedger').doc(userId).collection('entries').doc(ledgerEntryId).set({
        type: type,
        amount: amount,
        status: 'rejected',
        description: `${description} (Rejected: ${capResult.reason})`,
        reference: metadata.reference || '',
        metadata: { ...metadata, capReached: true, rejectionReason: capResult.reason },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      throw new Error(`Income not credited: ${capResult.reason}. Please renew your ID to continue earning.`);
    }
  }
  
  // Update both users collection (legacy) and wallets collection (new system)
  const currentBalance = userDoc.data().walletBalance || 0;
  const currentIncome = userDoc.data().totalIncome || 0;
  const newBalance = currentBalance + amount;
  const newIncome = currentIncome + amount;
  
  // Update users collection (legacy support)
  await userRef.update({
    walletBalance: newBalance,
    totalIncome: newIncome,
    lastIncomeUpdate: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Update wallets collection (new system - used by UI)
  const walletRef = db.collection('wallets').doc(userId);
  const walletDoc = await walletRef.get();
  
  if (walletDoc.exists) {
    // Update existing wallet
    const currentAvailable = walletDoc.data().availableBalance || 0;
    const currentPending = walletDoc.data().pendingBalance || 0;
    const currentLifetimeEarned = walletDoc.data().lifetimeEarned || 0;
    
    await walletRef.update({
      availableBalance: currentAvailable + amount,
      lifetimeEarned: currentLifetimeEarned + (amount > 0 ? amount : 0),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } else {
    // Create new wallet document
    await walletRef.set({
      availableBalance: amount > 0 ? amount : 0,
      pendingBalance: 0,
      lifetimeEarned: amount > 0 ? amount : 0,
      lifetimeWithdrawn: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  
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
  
  // Create income ledger entry
  const ledgerEntryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const ledgerStatus = type === 'REFERRAL_DIRECT' ? 'APPROVED' : 'completed';
  await db.collection('incomeLedger').doc(userId).collection('entries').doc(ledgerEntryId).set({
    type: type,
    amount: amount,
    status: ledgerStatus,
    description: description,
    reference: transactionId,
    metadata: metadata,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return { newBalance, transactionId, ledgerEntryId };
}

// Daily ROI Distribution - Runs every day at 12 AM IST (midnight)
exports.distributeDailyROI = functions.pubsub.schedule('0 0 * * 1-5')
  .timeZone('Asia/Kolkata')
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
        
        // Skip Leaders - they don't get ROI
        if (pkg.packageId === 'LEADER_PROGRAM' || pkg.isLeaderProgram === true) {
          console.log(`Package ${pkg.id} is Leader program - skipping ROI`);
          continue;
        }
        
        // Check user's program type
        const userDoc = await db.collection('users').doc(pkg.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData.programType === 'leader') {
            console.log(`User ${pkg.userId} is Leader - skipping ROI`);
            continue;
          }
          
          // Check program config
          const programConfig = await db.collection('adminConfig').doc('programs').get();
          const config = programConfig.exists ? programConfig.data() : {};
          if (userData.programType === 'leader' && config.leaderROIEnabled !== true) {
            console.log(`User ${pkg.userId} is Leader with ROI disabled - skipping`);
            continue;
          }
        }
        
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

// Helper function to distribute referral income (reusable)
async function distributeReferralIncomeForActivation(userId, packageId, activationAmount, packageData) {
  try {
    console.log(`Processing referral income for user ${userId}, package ${packageId}`);
    
    // Get user data
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log(`User ${userId} not found`);
      return { success: false, reason: 'user_not_found' };
    }

    const userData = userDoc.data();

    // HARD RULE: If referee is Leader, NO referral income
    if (userData.programType === 'leader' || packageData.packageId === 'LEADER_PROGRAM') {
      console.log(`User ${userId} is Leader - NO referral income distributed`);
      // Still update stats for hierarchy
      if (userData.referredByUid) {
        const referrerRef = db.collection('users').doc(userData.referredByUid);
        const referrerDoc = await referrerRef.get();
        if (referrerDoc.exists) {
          const currentCount = referrerDoc.data().directReferrals || 0;
          await referrerRef.update({
            directReferrals: currentCount + 1
          });
        }
      }
      return { success: false, reason: 'referee_is_leader' };
    }

    // Get referral income config
    const referralConfigDoc = await db.collection('adminConfig').doc('referralIncome').get();
    const referralConfig = referralConfigDoc.exists ? referralConfigDoc.data() : {
      enableReferralIncomeGlobal: true,
      enableInvestorReferralIncome: true,
      enableLeaderReferralIncome: false,
      directReferralPercent: 5.0,
      enableMultiLevelIncome: false, // Default OFF
      maxLevels: 25,
      levelReferralPercents: [], // Empty by default
      referralIncomeCountsTowardCap: true,
      referralIncomeEligibleStatuses: ['ACTIVE_INVESTOR'],
      referralIncomePayoutMode: 'INSTANT_TO_WALLET',
      minActivationAmountForReferral: 0,
      antiAbuseLimits: {
        blockSelfReferral: true,
        blockCircularReferral: true,
        maxReferralIncomePerDay: 0,
        maxPerReferredUser: 0
      }
    };

    // Check if referral income is globally enabled
    if (!referralConfig.enableReferralIncomeGlobal || !referralConfig.enableInvestorReferralIncome) {
      console.log('Referral income is disabled globally');
      // Still update stats
      if (userData.referredByUid) {
        const referrerRef = db.collection('users').doc(userData.referredByUid);
        const referrerDoc = await referrerRef.get();
        if (referrerDoc.exists) {
          const currentCount = referrerDoc.data().directReferrals || 0;
          await referrerRef.update({
            directReferrals: currentCount + 1
          });
        }
      }
      return { success: false, reason: 'referral_income_disabled' };
    }

    // Check if referee status is eligible
    if (!referralConfig.referralIncomeEligibleStatuses?.includes(userData.status)) {
      console.log(`User ${userId} status ${userData.status} is not eligible for referral income`);
      // Still update stats
      if (userData.referredByUid) {
        const referrerRef = db.collection('users').doc(userData.referredByUid);
        const referrerDoc = await referrerRef.get();
        if (referrerDoc.exists) {
          const currentCount = referrerDoc.data().directReferrals || 0;
          await referrerRef.update({
            directReferrals: currentCount + 1
          });
        }
      }
      return { success: false, reason: 'referee_status_not_eligible' };
    }

    // Check minimum activation amount
    if (activationAmount < (referralConfig.minActivationAmountForReferral || 0)) {
      console.log(`Activation amount ${activationAmount} is below minimum for referral income`);
      // Still update stats
      if (userData.referredByUid) {
        const referrerRef = db.collection('users').doc(userData.referredByUid);
        const referrerDoc = await referrerRef.get();
        if (referrerDoc.exists) {
          const currentCount = referrerDoc.data().directReferrals || 0;
          await referrerRef.update({
            directReferrals: currentCount + 1
          });
        }
      }
      return { success: false, reason: 'below_minimum_amount' };
    }

    // Get referrer (upline)
    if (!userData.referredByUid) {
      console.log(`User ${userId} has no referrer`);
      return { success: false, reason: 'no_referrer' };
    }

    const referrerId = userData.referredByUid;
    const referrerDoc = await db.collection('users').doc(referrerId).get();

    if (!referrerDoc.exists) {
      console.log(`Referrer ${referrerId} not found`);
      return { success: false, reason: 'referrer_not_found' };
    }

    const referrerData = referrerDoc.data();

    // HARD RULE: If upline is Leader, NO referral income
    if (referrerData.programType === 'leader') {
      console.log(`Referrer ${referrerId} is Leader - NO referral income distributed`);
      // Still update stats
      const currentCount = referrerData.directReferrals || 0;
      await db.collection('users').doc(referrerId).update({
        directReferrals: currentCount + 1
      });
      return { success: false, reason: 'referrer_is_leader' };
    }

    // HARD RULE: Only pay to ACTIVE_INVESTOR uplines
    if (referrerData.status !== 'ACTIVE_INVESTOR') {
      console.log(`Referrer ${referrerId} status ${referrerData.status} is not ACTIVE_INVESTOR - NO referral income`);
      // Still update stats
      const currentCount = referrerData.directReferrals || 0;
      await db.collection('users').doc(referrerId).update({
        directReferrals: currentCount + 1
      });
      return { success: false, reason: 'referrer_not_active_investor' };
    }

    // Check if referral income already processed for this user
    // Only skip if APPROVED/COMPLETED entry exists AND wallet was credited
    // Check REFERRAL_DIRECT and REFERRAL_LEVEL separately to avoid index issues
    let existingIncomeEntry = { empty: true };
    
    try {
      // Check for REFERRAL_DIRECT with APPROVED/COMPLETED status
      const directIncome = await db.collection('incomeLedger').doc(referrerId).collection('entries')
        .where('type', '==', 'REFERRAL_DIRECT')
        .where('metadata.sourceUid', '==', userId)
        .where('status', 'in', ['APPROVED', 'approved', 'COMPLETED', 'completed'])
        .limit(1)
        .get();
      
      if (!directIncome.empty) {
        existingIncomeEntry = directIncome;
      } else {
        // Check for REFERRAL_LEVEL with APPROVED/COMPLETED status
        const levelIncome = await db.collection('incomeLedger').doc(referrerId).collection('entries')
          .where('type', '==', 'REFERRAL_LEVEL')
          .where('metadata.sourceUid', '==', userId)
          .where('status', 'in', ['APPROVED', 'approved', 'COMPLETED', 'completed'])
          .limit(1)
          .get();
        
        if (!levelIncome.empty) {
          existingIncomeEntry = levelIncome;
        }
      }
    } catch (error) {
      // If query fails (e.g., missing index), check without status filter
      console.log(`Status query failed, checking without status filter: ${error.message}`);
      try {
        const directIncome = await db.collection('incomeLedger').doc(referrerId).collection('entries')
          .where('type', '==', 'REFERRAL_DIRECT')
          .where('metadata.sourceUid', '==', userId)
          .limit(1)
          .get();
        
        if (!directIncome.empty) {
          const entry = directIncome.docs[0].data();
          // Only skip if status is APPROVED/COMPLETED
          if (entry.status === 'APPROVED' || entry.status === 'approved' || 
              entry.status === 'COMPLETED' || entry.status === 'completed') {
            existingIncomeEntry = directIncome;
          }
        }
      } catch (fallbackError) {
        console.error(`Fallback check also failed: ${fallbackError.message}`);
        // Continue processing if check fails
      }
    }

    if (!existingIncomeEntry.empty) {
      const existingEntry = existingIncomeEntry.docs[0].data();
      console.log(`Referral income already processed for user ${userId} (found APPROVED/COMPLETED entry with packageId: ${existingEntry.metadata?.packageId})`);
      
      // Verify wallet was actually credited
      try {
        const walletDoc = await db.collection('wallets').doc(referrerId).get();
        if (walletDoc.exists) {
          const walletData = walletDoc.data();
          const availableBalance = walletData.availableBalance || 0;
          const entryAmount = existingEntry.amount || 0;
          
          // If entry exists but wallet balance is suspiciously low, allow reprocessing
          // This handles cases where ledger entry exists but wallet wasn't credited
          if (availableBalance < entryAmount * 0.1) { // If wallet is less than 10% of entry amount, likely not credited
            console.log(`Warning: Entry exists (${entryAmount}) but wallet balance (${availableBalance}) is low. Allowing reprocess.`);
            // Don't skip - allow processing to continue
            existingIncomeEntry = { empty: true };
          }
        }
      } catch (walletError) {
        console.error(`Error checking wallet: ${walletError.message}`);
        // If wallet check fails, skip to be safe
      }
    }

    if (!existingIncomeEntry.empty) {
      // Still update stats if not already updated
      const currentCount = referrerData.directReferrals || 0;
      await db.collection('users').doc(referrerId).update({
        directReferrals: currentCount + 1
      });
      return { success: false, reason: 'already_processed' };
    }

    // Anti-abuse: Check self-referral
    if (referralConfig.antiAbuseLimits?.blockSelfReferral && referrerId === userId) {
      console.log(`Self-referral detected for ${userId} - BLOCKED`);
      return { success: false, reason: 'self_referral_blocked' };
    }

    // Anti-abuse: Check circular referral
    if (referralConfig.antiAbuseLimits?.blockCircularReferral) {
      const refereeReferrer = userData.referredByUid;
      const referrerReferrerDoc = await db.collection('users').doc(referrerId).get();
      if (referrerReferrerDoc.exists && referrerReferrerDoc.data().referredByUid === userId) {
        console.log(`Circular referral detected between ${userId} and ${referrerId} - BLOCKED`);
        // Still update stats
        const currentCount = referrerData.directReferrals || 0;
        await db.collection('users').doc(referrerId).update({
          directReferrals: currentCount + 1
        });
        return { success: false, reason: 'circular_referral_blocked' };
      }
    }

    // Calculate direct referral income (Level 1)
    const directReferralPercent = referralConfig.directReferralPercent || 5.0;
    const directReferralAmount = (activationAmount * directReferralPercent) / 100;

    // Get level percentages for multi-level income
    const levelPercentages = referralConfig.levelReferralPercents || [];
    const enableMultiLevel = referralConfig.enableMultiLevelIncome !== false && levelPercentages.length > 0;
    const maxLevels = referralConfig.maxLevels || 25;

    // Anti-abuse: Check daily limit (for direct referral only)
    if (referralConfig.antiAbuseLimits?.maxReferralIncomePerDay > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = admin.firestore.Timestamp.fromDate(today);
      
      const todayReferralIncome = await db.collection('incomeLedger').doc(referrerId)
        .collection('entries')
        .where('type', '==', 'REFERRAL_DIRECT')
        .where('createdAt', '>=', todayStart)
        .where('status', '==', 'APPROVED')
        .get();
      
      const todayTotal = todayReferralIncome.docs.reduce((sum, doc) => {
        return sum + (doc.data().amount || 0);
      }, 0);
      
      if (todayTotal + directReferralAmount > referralConfig.antiAbuseLimits.maxReferralIncomePerDay) {
        console.log(`Daily referral income limit reached for ${referrerId}`);
        // Still update stats
        const currentCount = referrerData.directReferrals || 0;
        await db.collection('users').doc(referrerId).update({
          directReferrals: currentCount + 1
        });
        return { success: false, reason: 'daily_limit_reached' };
      }
    }

    // Anti-abuse: Check per-user limit
    if (referralConfig.antiAbuseLimits?.maxPerReferredUser > 0) {
      const userReferralIncome = await db.collection('incomeLedger').doc(referrerId)
        .collection('entries')
        .where('type', 'in', ['REFERRAL_DIRECT', 'REFERRAL_LEVEL'])
        .where('metadata.sourceUid', '==', userId)
        .where('status', '==', 'APPROVED')
        .get();
      
      const userTotal = userReferralIncome.docs.reduce((sum, doc) => {
        return sum + (doc.data().amount || 0);
      }, 0);
      
      if (userTotal + directReferralAmount > referralConfig.antiAbuseLimits.maxPerReferredUser) {
        console.log(`Per-user referral income limit reached for ${referrerId} from ${userId}`);
        // Still update stats
        const currentCount = referrerData.directReferrals || 0;
        await db.collection('users').doc(referrerId).update({
          directReferrals: currentCount + 1
        });
        return { success: false, reason: 'per_user_limit_reached' };
      }
    }

    // Credit direct referral income (Level 1)
    const payoutMode = referralConfig.referralIncomePayoutMode || 'INSTANT_TO_WALLET';
    const ledgerStatus = payoutMode === 'INSTANT_TO_WALLET' ? 'APPROVED' : 'PENDING';
    
    // Mask email for privacy
    const maskedEmail = userData.email ? 
      userData.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 
      'User';
    
    const directDescription = `Direct referral income (Level 1) from ${maskedEmail} activation`;
    
    // Credit direct referral income to wallet if instant
    if (payoutMode === 'INSTANT_TO_WALLET') {
      await updateUserWallet(
        referrerId,
        directReferralAmount,
        'REFERRAL_DIRECT',
        directDescription,
        {
          sourceUid: userId,
          packageId: packageId,
          activationAmount: activationAmount,
          referralPercent: directReferralPercent,
          level: 1,
          countsTowardCap: referralConfig.referralIncomeCountsTowardCap || false
        },
        !referralConfig.referralIncomeCountsTowardCap // Skip cap check if referral doesn't count toward cap
      );
    } else {
      // Create pending ledger entry
      const ledgerEntryId = `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.collection('incomeLedger').doc(referrerId).collection('entries').doc(ledgerEntryId).set({
        type: 'REFERRAL_DIRECT',
        amount: directReferralAmount,
        status: 'PENDING',
        description: directDescription,
        reference: packageId,
        metadata: {
          sourceUid: userId,
          packageId: packageId,
          activationAmount: activationAmount,
          referralPercent: directReferralPercent,
          level: 1,
          countsTowardCap: referralConfig.referralIncomeCountsTowardCap || false
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // Update referrer's direct referrals count
    const currentCount = referrerData.directReferrals || 0;
    await db.collection('users').doc(referrerId).update({
      directReferrals: currentCount + 1
    });
    
    // Create audit log for direct referral
    await db.collection('auditLogs').add({
      action: 'referral_income_credited',
      referrerUid: referrerId,
      refereeUid: userId,
      amount: directReferralAmount,
      level: 1,
      activationAmount: activationAmount,
      referralPercent: directReferralPercent,
      packageId: packageId,
      status: ledgerStatus,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      performedBy: 'system'
    });
    
    console.log(`Direct referral income distributed: ${directReferralAmount} to ${referrerId} (Level 1) from ${userId} activation`);
    
    // Distribute multi-level income (Level 2+)
    let totalLevelIncome = 0;
    const levelIncomeResults = [];
    
    if (enableMultiLevel) {
      // Get upline chain starting from the direct referrer
      const uplineChain = await getUplineChain(referrerId, maxLevels);
      
      for (const upline of uplineChain) {
        const level = upline.level;
        const uplineUid = upline.uid;
        
        // Get level percentage
        const levelPercent = getLevelPercentage(level, levelPercentages);
        if (levelPercent <= 0) {
          continue; // Skip if no percentage for this level
        }
        
        // Get upline user data
        const uplineDoc = await db.collection('users').doc(uplineUid).get();
        if (!uplineDoc.exists) {
          console.log(`Upline ${uplineUid} at level ${level} not found`);
          continue;
        }
        
        const uplineData = uplineDoc.data();
        
        // HARD RULE: Only pay to ACTIVE_INVESTOR uplines
        if (uplineData.programType !== 'investor' || uplineData.status !== 'ACTIVE_INVESTOR') {
          console.log(`Upline ${uplineUid} at level ${level} is not ACTIVE_INVESTOR - skipping`);
          continue;
        }
        
        // HARD RULE: If upline is Leader, NO referral income
        if (uplineData.programType === 'leader') {
          console.log(`Upline ${uplineUid} at level ${level} is Leader - NO referral income`);
          continue;
        }
        
        // Qualification Rules Check
        if (referralConfig.enableQualificationRules) {
          const qualificationRules = referralConfig.qualificationRules || {};
          const uplineDirectCount = uplineData.directReferrals || 0;
          let qualified = false;
          
          if (level >= 1 && level <= 3) {
            const minDirects = qualificationRules.level1to3?.minDirects || 5;
            qualified = uplineDirectCount >= minDirects;
            if (!qualified) {
              console.log(`Upline ${uplineUid} at level ${level} does not meet qualification (has ${uplineDirectCount} directs, needs ${minDirects})`);
              continue;
            }
          } else if (level >= 4 && level <= 13) {
            const ratio = qualificationRules.level4to13?.directsPerLevel || 2;
            const requiredDirects = Math.ceil(level / ratio);
            qualified = uplineDirectCount >= requiredDirects;
            if (!qualified) {
              console.log(`Upline ${uplineUid} at level ${level} does not meet qualification (has ${uplineDirectCount} directs, needs ${requiredDirects})`);
              continue;
            }
          } else if (level >= 14 && level <= 25) {
            const ratio = qualificationRules.level14to25?.directsPerLevel || 3;
            const requiredDirects = Math.ceil(level / ratio);
            qualified = uplineDirectCount >= requiredDirects;
            if (!qualified) {
              console.log(`Upline ${uplineUid} at level ${level} does not meet qualification (has ${uplineDirectCount} directs, needs ${requiredDirects})`);
              continue;
            }
          }
        }
        
        // Calculate level income
        const levelAmount = (activationAmount * levelPercent) / 100;
        
        // Check if level income already processed for this user at this level
        // We check by sourceUid and level to avoid duplicates
        const existingLevelIncome = await db.collection('incomeLedger').doc(uplineUid).collection('entries')
          .where('type', '==', 'REFERRAL_LEVEL')
          .where('metadata.sourceUid', '==', userId)
          .where('metadata.level', '==', level)
          .limit(1)
          .get();
        
        if (!existingLevelIncome.empty) {
          console.log(`Level ${level} income already processed for ${uplineUid} from ${userId}`);
          continue;
        }
        
        // Credit level income
        const levelDescription = `Level ${level} referral income from ${maskedEmail} activation`;
        
        if (payoutMode === 'INSTANT_TO_WALLET') {
          await updateUserWallet(
            uplineUid,
            levelAmount,
            'REFERRAL_LEVEL',
            levelDescription,
            {
              sourceUid: userId,
              packageId: packageId,
              activationAmount: activationAmount,
              referralPercent: levelPercent,
              level: level,
              countsTowardCap: referralConfig.referralIncomeCountsTowardCap || false
            },
            !referralConfig.referralIncomeCountsTowardCap
          );
        } else {
          // Create pending ledger entry
          const levelEntryId = `ref_level_${level}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await db.collection('incomeLedger').doc(uplineUid).collection('entries').doc(levelEntryId).set({
            type: 'REFERRAL_LEVEL',
            amount: levelAmount,
            status: 'PENDING',
            description: levelDescription,
            reference: packageId,
            metadata: {
              sourceUid: userId,
              packageId: packageId,
              activationAmount: activationAmount,
              referralPercent: levelPercent,
              level: level,
              countsTowardCap: referralConfig.referralIncomeCountsTowardCap || false
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        
        totalLevelIncome += levelAmount;
        levelIncomeResults.push({ level, uplineUid, amount: levelAmount });
        
        // Create audit log for level income
        await db.collection('auditLogs').add({
          action: 'level_referral_income_credited',
          referrerUid: uplineUid,
          refereeUid: userId,
          amount: levelAmount,
          level: level,
          activationAmount: activationAmount,
          referralPercent: levelPercent,
          packageId: packageId,
          status: ledgerStatus,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          performedBy: 'system'
        });
        
        console.log(`Level ${level} referral income distributed: ${levelAmount} to ${uplineUid} from ${userId} activation`);
      }
    }
    
    const totalDistributed = directReferralAmount + totalLevelIncome;
    console.log(`Total referral income distributed: ${totalDistributed} (Direct: ${directReferralAmount}, Levels: ${totalLevelIncome}) from ${userId} activation`);
    
    return { 
      success: true, 
      directAmount: directReferralAmount, 
      levelAmount: totalLevelIncome,
      totalAmount: totalDistributed,
      directReferrerId: referrerId,
      levelResults: levelIncomeResults
    };
    
  } catch (error) {
    console.error('Error in distributeReferralIncomeForActivation:', error);
    throw error;
  }
}

// Package Activation Handler - Triggers referral income distribution
exports.onPackageActivated = functions.firestore
  .document('userPackages/{packageId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Only process when status changes from pending to active
    if (before.status !== 'pending' || after.status !== 'active') {
      return null;
    }
    
    console.log(`Package ${context.params.packageId} activated - Processing referral income...`);
    
    try {
      const userId = after.userId;
      const packageId = context.params.packageId;
      const activationAmount = after.amount || after.inrPrice || 0;
      
      // Get user data
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        console.log(`User ${userId} not found`);
        return null;
      }
      
      const userData = userDoc.data();
      
      // Update user status and programType if activating an Investor plan (not Leader)
      if (after.packageId !== 'LEADER_PROGRAM') {
        // User is activating an Investor plan
        const userUpdate = {};
        if (userData.programType !== 'investor' || userData.status !== 'ACTIVE_INVESTOR') {
          userUpdate.programType = 'investor';
          userUpdate.status = 'ACTIVE_INVESTOR';
          userUpdate.updatedAt = admin.firestore.FieldValue.serverTimestamp();
          await db.collection('users').doc(userId).update(userUpdate);
          console.log(`Updated user ${userId} to ACTIVE_INVESTOR`);
        }
      }
      
      // Distribute referral income using the reusable function
      await distributeReferralIncomeForActivation(userId, packageId, activationAmount, after);
      
      return null;
      
    } catch (error) {
      console.error('Error in package activation handler:', error);
      throw error;
    }
  });

// Achievement-Based Level Income Distribution (NOT referral-based)
// This function will be called when users complete achievements/tasks
async function distributeAchievementLevelIncome(userId, achievementType, amount, description, metadata = {}) {
  try {
    // Get user's program type
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new Error(`User ${userId} not found`);
    }
    
    const userData = userDoc.data();
    
    // Only Leaders get achievement-based level income
    if (userData.programType !== 'leader') {
      console.log(`User ${userId} is not a Leader. Skipping achievement level income.`);
      return;
    }
    
    // Check if ROI is disabled for leaders (it should be)
    const programConfig = await db.collection('adminConfig').doc('programs').get();
    const config = programConfig.exists ? programConfig.data() : {};
    
    if (config.leaderROIEnabled === true) {
      console.warn(`Warning: ROI is enabled for leaders but should be disabled`);
    }
    
    // Credit achievement-based level income
    await updateUserWallet(
      userId,
      amount,
      'achievement_level_income',
      description,
      {
        achievementType: achievementType,
        ...metadata
      }
    );
    
    console.log(`Achievement level income distributed: ${amount} to ${userId}`);
  } catch (error) {
    console.error('Error distributing achievement level income:', error);
    throw error;
  }
}

// Weekly Payout Processing - Runs every Monday at 9 AM UTC
exports.processWeeklyPayouts = functions.pubsub.schedule('0 9 * * 1')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('Starting weekly payout processing...');
    
    try {
      // Get payout config
      const payoutConfigDoc = await db.collection('adminConfig').doc('payouts').get();
      const payoutConfig = payoutConfigDoc.exists ? payoutConfigDoc.data() : {
        enableWeeklyPayouts: true,
        enforceCutoff: true,
        cutoffDay: 'FRIDAY',
        payoutReleaseDay: 'MONDAY',
        adminChargesPercent: 10.0,
        adminChargesApplyTo: ['daily_roi', 'REFERRAL_DIRECT', 'REFERRAL_LEVEL', 'level_income', 'bonus']
      };
      
      // Check if weekly payouts are enabled
      if (!payoutConfig.enableWeeklyPayouts) {
        console.log('Weekly payouts are disabled');
        return null;
      }
      
      // Check cutoff enforcement
      if (payoutConfig.enforceCutoff) {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const cutoffDay = payoutConfig.cutoffDay || 'FRIDAY';
        const payoutReleaseDay = payoutConfig.payoutReleaseDay || 'MONDAY';
        
        // Map day names to day numbers
        const dayMap = {
          'SUNDAY': 0,
          'MONDAY': 1,
          'TUESDAY': 2,
          'WEDNESDAY': 3,
          'THURSDAY': 4,
          'FRIDAY': 5,
          'SATURDAY': 6
        };
        
        const cutoffDayNum = dayMap[cutoffDay] ?? 5; // Default to Friday
        const releaseDayNum = dayMap[payoutReleaseDay] ?? 1; // Default to Monday
        
        // Check if today is the release day
        if (dayOfWeek !== releaseDayNum) {
          console.log(`Today is not ${payoutReleaseDay}. Payout processing only runs on ${payoutReleaseDay}.`);
          return null;
        }
        
        // Calculate last cutoff day
        let daysSinceCutoff = (dayOfWeek - cutoffDayNum + 7) % 7;
        if (daysSinceCutoff === 0) {
          daysSinceCutoff = 7; // If same day, it's been 7 days
        }
        
        // Verify last cutoff has passed (should be at least 3 days ago for Friday->Monday)
        if (daysSinceCutoff < 3) {
          console.log(`Last ${cutoffDay} cutoff has not passed yet. Days since cutoff: ${daysSinceCutoff}`);
          return null;
        }
        
        console.log(`Cutoff check passed. Last ${cutoffDay} was ${daysSinceCutoff} days ago.`);
      }
      
      // Get admin charges from payout config (preferred) or terms config (fallback)
      const adminChargesPercent = payoutConfig.adminChargesPercent || (await getTermsConfig()).adminChargesPercent || 10;
      
      // Get all wallets with available balance > 0
      const walletsSnapshot = await db.collection('wallets')
        .where('availableBalance', '>', 0)
        .get();
      
      if (walletsSnapshot.empty) {
        console.log('No wallets with available balance found.');
        return null;
      }
      
      let processedCount = 0;
      let totalPayouts = 0;
      
      for (const walletDoc of walletsSnapshot.docs) {
        const walletData = walletDoc.data();
        const userId = walletDoc.id;
        const walletBalance = walletData.availableBalance || 0;
        
        // Check minimum payout amount
        const minPayoutAmount = payoutConfig.minPayoutAmount || 0;
        if (minPayoutAmount > 0 && walletBalance < minPayoutAmount) {
          console.log(`User ${userId} wallet balance ${walletBalance} is below minimum payout ${minPayoutAmount}`);
          continue;
        }
        
        // Check maximum payout amount
        const maxPayoutAmount = payoutConfig.maxPayoutAmount || 0;
        const effectiveBalance = maxPayoutAmount > 0 && walletBalance > maxPayoutAmount 
          ? maxPayoutAmount 
          : walletBalance;
        
        if (effectiveBalance <= 0) continue;
        
        // Calculate admin charges
        const adminCharges = (effectiveBalance * adminChargesPercent) / 100;
        const payoutAmount = effectiveBalance - adminCharges;
        
        // Create payout record
        const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.collection('payouts').doc(payoutId).set({
          userId: userId,
          walletBalanceBefore: walletBalance,
          effectiveBalance: effectiveBalance,
          payoutAmount: payoutAmount,
          adminCharges: adminCharges,
          adminChargesPercent: adminChargesPercent,
          status: payoutConfig.autoProcessPayouts ? 'approved' : 'pending', // Auto-process if enabled
          requestedAt: admin.firestore.FieldValue.serverTimestamp(),
          week: context.timestamp,
          cutoffDay: payoutConfig.cutoffDay || 'FRIDAY',
          payoutReleaseDay: payoutConfig.payoutReleaseDay || 'MONDAY'
        });
        
        // Update wallet balance (deduct effective balance)
        await walletDoc.ref.update({
          availableBalance: admin.firestore.FieldValue.increment(-effectiveBalance),
          pendingBalance: admin.firestore.FieldValue.increment(payoutAmount),
          lastPayoutRequest: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Also update users collection for backward compatibility
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          await userDoc.ref.update({
            walletBalance: admin.firestore.FieldValue.increment(-effectiveBalance),
            pendingPayout: admin.firestore.FieldValue.increment(payoutAmount),
            lastPayoutRequest: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        
        // Create transaction record
        const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.collection('transactions').doc(transactionId).set({
          userId: userId,
          amount: -effectiveBalance,
          type: 'payout_request',
          description: `Weekly payout request (Admin charges: ${adminChargesPercent}%)`,
          status: payoutConfig.autoProcessPayouts ? 'approved' : 'pending',
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

    // Check cap status for withdrawals (if capAction blocks withdrawals)
    const renewalConfig = await getRenewalConfig();
    if (renewalConfig.enableIdRenewalRule) {
      const activePackage = await getActivePackage(userId);
      if (activePackage) {
        if (activePackage.capStatus === 'CAP_REACHED' || activePackage.capStatus === 'RENEWAL_PENDING') {
          if (renewalConfig.capAction === 'BLOCK_WITHDRAWALS' || renewalConfig.capAction === 'STOP_BOTH') {
            throw new functions.https.HttpsError('failed-precondition', 
              renewalConfig.renewalRequiredMessage || 'You reached 3× cap. Renew ID to continue withdrawing.');
          }
        }
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

    // Check cutoff day and time enforcement
    if (config.cutoffDay && config.cutoffTime) {
      const now = new Date();
      const currentDay = now.toLocaleString('en-US', { weekday: 'long' }).toLowerCase();
      const cutoffDay = config.cutoffDay.toLowerCase();
      
      // Check if today is after cutoff day
      const dayOrder = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDayIndex = dayOrder.indexOf(currentDay);
      const cutoffDayIndex = dayOrder.indexOf(cutoffDay);
      
      // If current day is after cutoff day, withdrawals are blocked until Monday
      if (currentDayIndex > cutoffDayIndex) {
        throw new functions.https.HttpsError('failed-precondition', 
          `Withdrawals are closed after ${cutoffDay}. Next payout cycle starts Monday.`);
      }
      
      // If today is cutoff day, check time
      if (currentDayIndex === cutoffDayIndex) {
        const [cutoffHour, cutoffMinute] = config.cutoffTime.split(':').map(Number);
        const cutoffTime = new Date(now);
        cutoffTime.setHours(cutoffHour, cutoffMinute, 0, 0);
        
        if (now >= cutoffTime) {
          throw new functions.https.HttpsError('failed-precondition', 
            `Withdrawal cutoff time (${config.cutoffTime}) has passed. Next payout cycle starts Monday.`);
        }
      }
      
      // Check if withdrawals are allowed on this day
      const allowedDays = config.allowedDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      if (!allowedDays.map(d => d.toLowerCase()).includes(currentDay)) {
        throw new functions.https.HttpsError('failed-precondition', 
          `Withdrawals are not allowed on ${currentDay}. Allowed days: ${allowedDays.join(', ')}`);
      }
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

    // Update user status and programType if activating an Investor plan (not Leader)
    if (planId !== 'LEADER_PROGRAM') {
      const userUpdate = {};
      if (targetData.programType !== 'investor' || targetData.status !== 'ACTIVE_INVESTOR') {
        userUpdate.programType = 'investor';
        userUpdate.status = 'ACTIVE_INVESTOR';
        userUpdate.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        await db.collection('users').doc(targetUid).update(userUpdate);
        console.log(`Updated user ${targetUid} to ACTIVE_INVESTOR via sponsor activation`);
      }
    }

    // Distribute referral income (since package was created directly as 'active', trigger won't fire)
    if (planId !== 'LEADER_PROGRAM') {
      try {
        await distributeReferralIncomeForActivation(targetUid, userPackageId, amount, {
          packageId: planId,
          amount: amount,
          inrPrice: amount
        });
      } catch (error) {
        console.error('Error distributing referral income in sponsor activation:', error);
        // Don't fail the activation if referral income distribution fails
      }
    }

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

// Admin Activation (Admin/SuperAdmin only)
exports.adminActivateUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if user is admin or superAdmin
  const adminDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User not found');
  }

  const adminData = adminDoc.data();
  const isAdmin = adminData.role === 'admin' || adminData.role === 'superAdmin' || 
                  context.auth.token.admin === true || context.auth.token.superAdmin === true;

  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can activate users');
  }

  try {
    const { targetUid, planId, activationSource, activationDate, notes, expiryDate, sponsorUid } = data;

    // Validate required fields
    if (!targetUid || !planId || !activationSource || !notes) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    // Validate activation source
    const validSources = ['admin_complimentary', 'paid_manual', 'sponsor_activation'];
    if (!validSources.includes(activationSource)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid activation source');
    }

    // Get target user
    const targetDoc = await db.collection('users').doc(targetUid).get();
    if (!targetDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Target user not found');
    }

    const targetData = targetDoc.data();
    if (targetData.status === 'blocked') {
      throw new functions.https.HttpsError('failed-precondition', 'Cannot activate blocked user');
    }

    // Get package details
    const packageDoc = await db.collection('packages').doc(planId).get();
    if (!packageDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Package not found');
    }

    const packageData = packageDoc.data();
    const amount = packageData.inrPrice || packageData.usdPrice || 0;

    // Check if user already has this package active
    const existingPackage = await db.collection('userPackages')
      .where('userId', '==', targetUid)
      .where('packageId', '==', planId)
      .where('status', '==', 'active')
      .get();

    if (!existingPackage.empty) {
      throw new functions.https.HttpsError('failed-precondition', 'User already has this package active');
    }

    // Handle sponsor activation source
    if (activationSource === 'sponsor_activation' && sponsorUid) {
      // Check if sponsor activation feature is enabled
      const featureConfig = await db.collection('adminConfig').doc('features').get();
      const features = featureConfig.exists ? featureConfig.data() : {};
      
      if (!features.enableSponsorActivation) {
        throw new functions.https.HttpsError('failed-precondition', 'Sponsor activation feature is disabled');
      }

      // Get sponsor data
      const sponsorDoc = await db.collection('users').doc(sponsorUid).get();
      if (!sponsorDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Sponsor user not found');
      }

      const sponsorData = sponsorDoc.data();
      const sponsorWallet = await db.collection('wallets').doc(sponsorUid).get();
      const sponsorBalance = sponsorWallet.exists ? (sponsorWallet.data().availableBalance || 0) : 0;

      if (sponsorBalance < amount) {
        throw new functions.https.HttpsError('failed-precondition', 'Sponsor has insufficient balance');
      }

      // Deduct from sponsor wallet
      await sponsorWallet.ref.update({
        availableBalance: admin.firestore.FieldValue.increment(-amount),
        lifetimeWithdrawn: admin.firestore.FieldValue.increment(amount)
      });

      // Create ledger entry for sponsor
      const sponsorEntryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.collection('incomeLedger').doc(sponsorUid).collection('entries').doc(sponsorEntryId).set({
        type: 'admin_activation_paid',
        amount: -amount,
        status: 'completed',
        description: `Admin activated ${packageData.name} for ${targetData.email} (via sponsor activation)`,
        reference: `admin_activation_${targetUid}`,
        metadata: { targetUid, planId, adminUid: context.auth.uid },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Create activation record
    const activationId = `admin_activation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const activationData = {
      targetUid: targetUid,
      targetEmailSnapshot: targetData.email,
      planId: planId,
      planName: packageData.name,
      amount: amount,
      activationSource: activationSource,
      status: 'completed',
      activatedBy: context.auth.uid,
      adminEmailSnapshot: adminData.email,
      notes: notes,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (activationDate) {
      activationData.activationDate = admin.firestore.Timestamp.fromDate(new Date(activationDate));
    }

    if (expiryDate) {
      activationData.expiryDate = admin.firestore.Timestamp.fromDate(new Date(expiryDate));
    }

    if (sponsorUid && activationSource === 'sponsor_activation') {
      activationData.sponsorUid = sponsorUid;
    }

    await db.collection('activations').doc(activationId).set(activationData);

    // Get renewal config for cap initialization
    const renewalConfig = await getRenewalConfig();
    const baseAmountInr = packageData.inrPrice || amount;
    const baseAmountUsd = packageData.usdPrice || 0;
    
    // Get program-specific multiplier (Investor = 2.0, Leader = 3.0)
    const programConfig = await db.collection('adminConfig').doc('programs').get();
    const programConfigData = programConfig.exists ? programConfig.data() : {};
    
    // Check if this is a Leader program
    let capMultiplier;
    if (planId === 'LEADER_PROGRAM') {
      capMultiplier = programConfigData.leaderCapMultiplier || 3.0;
    } else {
      // For Investors, use 2.0 multiplier
      capMultiplier = programConfigData.investorCapMultiplier || 2.0;
    }
    
    const capAmountInr = baseAmountInr * capMultiplier;
    const cycleNumber = 1; // First activation is cycle 1

    // Create user package
    const userPackageId = `${targetUid}_${planId}_${Date.now()}`;
    const packageDataToSave = {
      userId: targetUid,
      packageId: planId,
      packageName: packageData.name,
      amount: amount,
      currency: 'INR',
      status: 'active',
      activatedAt: activationDate ? admin.firestore.Timestamp.fromDate(new Date(activationDate)) : admin.firestore.FieldValue.serverTimestamp(),
      paymentMethod: activationSource === 'admin_complimentary' ? 'admin_complimentary' : 
                     activationSource === 'paid_manual' ? 'admin_manual_payment' : 'sponsor_activation',
      activationId: activationId,
      activatedBy: context.auth.uid,
      notes: notes,
      // Cap and renewal fields
      baseAmountInr: baseAmountInr,
      baseAmountUsd: baseAmountUsd,
      cycleNumber: cycleNumber,
      capMultiplier: capMultiplier,
      capAmountInr: capAmountInr,
      capStatus: 'ACTIVE',
      capReachedAt: null,
      renewalPolicySnapshot: {
        capAction: renewalConfig.capAction,
        eligibleIncomeTypes: renewalConfig.eligibleIncomeTypes,
        graceLimitInr: renewalConfig.graceLimitInr
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (expiryDate) {
      packageDataToSave.expiryDate = admin.firestore.Timestamp.fromDate(new Date(expiryDate));
    }

    if (sponsorUid && activationSource === 'sponsor_activation') {
      packageDataToSave.sponsorUid = sponsorUid;
    }

    await db.collection('userPackages').doc(userPackageId).set(packageDataToSave);

    // Update user status and programType if activating an Investor plan (not Leader)
    if (planId !== 'LEADER_PROGRAM') {
      const userUpdate = {};
      if (targetData.programType !== 'investor' || targetData.status !== 'ACTIVE_INVESTOR') {
        userUpdate.programType = 'investor';
        userUpdate.status = 'ACTIVE_INVESTOR';
        userUpdate.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        await db.collection('users').doc(targetUid).update(userUpdate);
        console.log(`Updated user ${targetUid} to ACTIVE_INVESTOR via admin activation`);
      }
    }

    // Distribute referral income (since package was created directly as 'active', trigger won't fire)
    if (planId !== 'LEADER_PROGRAM') {
      try {
        await distributeReferralIncomeForActivation(targetUid, userPackageId, amount, {
          packageId: planId,
          amount: amount,
          inrPrice: amount
        });
      } catch (error) {
        console.error('Error distributing referral income in admin activation:', error);
        // Don't fail the activation if referral income distribution fails
      }
    }

    // Initialize earning cap tracker
    await db.collection('earningCaps').doc(`${targetUid}_${cycleNumber}`).set({
      uid: targetUid,
      cycleNumber: cycleNumber,
      eligibleEarningsTotalInr: 0,
      eligibleEarningsTotalUsd: 0,
      capAmountInr: capAmountInr,
      remainingInr: capAmountInr,
      capStatus: 'ACTIVE',
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create ledger entry for target user (if not complimentary, they get package but no wallet credit)
    const targetEntryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.collection('incomeLedger').doc(targetUid).collection('entries').doc(targetEntryId).set({
      type: 'admin_activation_received',
      amount: 0, // No wallet credit for activation
      status: 'completed',
      description: `Package ${packageData.name} activated by admin (${activationSource})`,
      reference: activationId,
      metadata: { adminUid: context.auth.uid, planId, activationSource },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create audit log
    await db.collection('auditLogs').add({
      action: 'admin_activation_created',
      targetUid: targetUid,
      planId: planId,
      amount: amount,
      activationSource: activationSource,
      activationId: activationId,
      notes: notes,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      performedBy: context.auth.uid,
      performedByEmail: adminData.email
    });

    return { 
      success: true, 
      activationId, 
      userPackageId,
      message: 'User activated successfully'
    };
  } catch (error) {
    console.error('Error in admin activation:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error activating user');
  }
});

// Process ID Renewal (Admin/User/Sponsor)
exports.processRenewal = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const { targetUid, renewalPlanId, renewalMethod, paymentReference, notes, sponsorUid } = data;

    if (!targetUid || !renewalMethod) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    const renewalConfig = await getRenewalConfig();
    
    // Check if renewal rule is enabled
    if (!renewalConfig.enableIdRenewalRule) {
      throw new functions.https.HttpsError('failed-precondition', 'ID renewal rule is disabled');
    }

    // Get target user
    const targetDoc = await db.collection('users').doc(targetUid).get();
    if (!targetDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Target user not found');
    }

    // Get active package
    const activePackage = await getActivePackage(targetUid);
    if (!activePackage) {
      throw new functions.https.HttpsError('failed-precondition', 'User has no active package');
    }

    // Check if renewal is needed
    if (activePackage.capStatus !== 'CAP_REACHED' && activePackage.capStatus !== 'RENEWAL_PENDING') {
      throw new functions.https.HttpsError('failed-precondition', 'User has not reached cap yet');
    }

    // Determine who is performing renewal
    const performerUid = context.auth.uid;
    const performerDoc = await db.collection('users').doc(performerUid).get();
    const performerData = performerDoc.exists ? performerDoc.data() : {};
    const isAdmin = performerData.role === 'admin' || performerData.role === 'superAdmin' || 
                    context.auth.token.admin === true || context.auth.token.superAdmin === true;

    // Validate renewal method permissions
    if (renewalMethod === 'admin_complimentary' && !isAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can perform complimentary renewals');
    }

    if (renewalMethod === 'sponsor_wallet' && (!sponsorUid || sponsorUid !== performerUid)) {
      throw new functions.https.HttpsError('permission-denied', 'Invalid sponsor for sponsor wallet renewal');
    }

    if (renewalMethod === 'user_wallet' && performerUid !== targetUid) {
      throw new functions.https.HttpsError('permission-denied', 'Only user can pay from their own wallet');
    }

    // Get renewal plan (use same plan if not specified)
    const planId = renewalPlanId || activePackage.packageId;
    const planDoc = await db.collection('packages').doc(planId).get();
    if (!planDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Renewal plan not found');
    }

    const planData = planDoc.data();
    const renewalAmount = planData.inrPrice || planData.usdPrice || activePackage.amount;
    const baseAmountInr = planData.inrPrice || renewalAmount;
    const baseAmountUsd = planData.usdPrice || 0;
    
    // Get program-specific multiplier based on user's program type
    const targetUserDoc = await db.collection('users').doc(targetUid).get();
    const targetUserData = targetUserDoc.exists ? targetUserDoc.data() : {};
    const programType = targetUserData.programType || 'investor';
    
    const programConfig = await db.collection('adminConfig').doc('programs').get();
    const programConfigData = programConfig.exists ? programConfig.data() : {};
    
    let capMultiplier;
    if (programType === 'leader') {
      capMultiplier = programConfigData.leaderCapMultiplier || 3.0;
    } else {
      // For Investors, use 2.0 multiplier
      capMultiplier = programConfigData.investorCapMultiplier || 2.0;
    }
    
    const capAmountInr = baseAmountInr * capMultiplier;
    const oldCycleNumber = activePackage.cycleNumber || 1;
    const newCycleNumber = oldCycleNumber + 1;

    // Process payment based on method
    if (renewalMethod === 'sponsor_wallet' && sponsorUid) {
      const sponsorWallet = await db.collection('wallets').doc(sponsorUid).get();
      const sponsorBalance = sponsorWallet.exists ? (sponsorWallet.data().availableBalance || 0) : 0;
      
      if (sponsorBalance < renewalAmount) {
        throw new functions.https.HttpsError('failed-precondition', 'Sponsor has insufficient balance');
      }

      await sponsorWallet.ref.update({
        availableBalance: admin.firestore.FieldValue.increment(-renewalAmount),
        lifetimeWithdrawn: admin.firestore.FieldValue.increment(renewalAmount)
      });

      // Create ledger entry for sponsor
      const sponsorEntryId = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.collection('incomeLedger').doc(sponsorUid).collection('entries').doc(sponsorEntryId).set({
        type: 'renewal_paid',
        amount: -renewalAmount,
        status: 'completed',
        description: `Renewal payment for ${targetDoc.data().email}`,
        reference: `renewal_${targetUid}_${newCycleNumber}`,
        metadata: { targetUid, cycleNumber: newCycleNumber },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    if (renewalMethod === 'user_wallet') {
      const userWallet = await db.collection('wallets').doc(targetUid).get();
      const userBalance = userWallet.exists ? (userWallet.data().availableBalance || 0) : 0;
      
      if (userBalance < renewalAmount) {
        throw new functions.https.HttpsError('failed-precondition', 'Insufficient wallet balance');
      }

      await userWallet.ref.update({
        availableBalance: admin.firestore.FieldValue.increment(-renewalAmount),
        lifetimeWithdrawn: admin.firestore.FieldValue.increment(renewalAmount)
      });
    }

    // Create renewal record
    const renewalId = `renewal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.collection('renewals').doc(renewalId).set({
      uid: targetUid,
      oldCycleNumber: oldCycleNumber,
      newCycleNumber: newCycleNumber,
      renewalPlanId: planId,
      renewalAmountInr: renewalAmount,
      method: renewalMethod,
      status: 'completed',
      paymentReference: paymentReference || null,
      sponsorUid: renewalMethod === 'sponsor_wallet' ? sponsorUid : null,
      adminUid: isAdmin ? performerUid : null,
      performedBy: performerUid,
      note: notes || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update user package for new cycle
    await db.collection('userPackages').doc(activePackage.id).update({
      cycleNumber: newCycleNumber,
      baseAmountInr: baseAmountInr,
      baseAmountUsd: baseAmountUsd,
      capMultiplier: capMultiplier,
      capAmountInr: capAmountInr,
      capStatus: 'ACTIVE',
      capReachedAt: null,
      renewalPolicySnapshot: {
        capAction: renewalConfig.capAction,
        eligibleIncomeTypes: renewalConfig.eligibleIncomeTypes,
        graceLimitInr: renewalConfig.graceLimitInr
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Reset earning cap tracker for new cycle
    await db.collection('earningCaps').doc(`${targetUid}_${newCycleNumber}`).set({
      uid: targetUid,
      cycleNumber: newCycleNumber,
      eligibleEarningsTotalInr: 0,
      eligibleEarningsTotalUsd: 0,
      capAmountInr: capAmountInr,
      remainingInr: capAmountInr,
      capStatus: 'ACTIVE',
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create audit log
    await db.collection('auditLogs').add({
      action: 'renewal_completed',
      targetUid: targetUid,
      renewalId: renewalId,
      oldCycleNumber: oldCycleNumber,
      newCycleNumber: newCycleNumber,
      planId: planId,
      amount: renewalAmount,
      method: renewalMethod,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      performedBy: performerUid,
      performedByEmail: performerData.email
    });

    return {
      success: true,
      renewalId: renewalId,
      newCycleNumber: newCycleNumber,
      message: 'Renewal completed successfully. Earnings resumed.'
    };
  } catch (error) {
    console.error('Error processing renewal:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error processing renewal');
  }
});

// Get User Downline Stats (Admin only)
exports.getUserDownlineStats = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if user is admin
  const adminDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User not found');
  }

  const adminData = adminDoc.data();
  const isAdmin = adminData.role === 'admin' || adminData.role === 'superAdmin' || 
                  context.auth.token.admin === true || context.auth.token.superAdmin === true;

  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can view downline stats');
  }

  try {
    const { userId, maxDepth = 10 } = data;

    if (!userId) {
      throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
    }

    // Get user stats (precomputed if available)
    const userStatsDoc = await db.collection('userStats').doc(userId).get();
    
    let directsCount = 0;
    let downlineCount = 0;

    if (userStatsDoc.exists) {
      const stats = userStatsDoc.data();
      directsCount = stats.directsCount || 0;
      downlineCount = stats.downlineCount || 0;
    } else {
      // Calculate on the fly if not precomputed
      const directsSnapshot = await db.collection('users')
        .where('referredByUid', '==', userId)
        .get();
      
      directsCount = directsSnapshot.size;
      downlineCount = directsCount; // Simplified - full calculation would be recursive
    }

    return {
      userId,
      directsCount,
      downlineCount,
      lastUpdated: userStatsDoc.exists ? userStatsDoc.data().lastUpdated : null
    };
  } catch (error) {
    console.error('Error getting downline stats:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error getting downline stats');
  }
});

// Get Full Downline Tree (Admin only)
exports.getUserDownlineTree = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId, maxDepth = 5 } = data;
  const requestingUid = context.auth.uid;

  // Check if user is admin
  const userDoc = await db.collection('users').doc(requestingUid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User not found');
  }

  const userData = userDoc.data();
  const isAdmin = userData.role === 'admin' || userData.role === 'superAdmin' || 
                  context.auth.token.admin === true || context.auth.token.superAdmin === true;

  // Allow if admin OR if requesting own tree
  if (!isAdmin && userId !== requestingUid) {
    throw new functions.https.HttpsError('permission-denied', 'You can only view your own downline tree');
  }

  try {

    if (!userId) {
      throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
    }

    // Recursive function to build tree
    async function buildTree(currentUserId, currentDepth) {
      if (currentDepth > maxDepth) {
        return null;
      }

      const userDoc = await db.collection('users').doc(currentUserId).get();
      if (!userDoc.exists) {
        return null;
      }

      const userData = userDoc.data();
      
      // Get wallet data
      const walletDoc = await db.collection('wallets').doc(currentUserId).get();
      const walletData = walletDoc.exists ? walletDoc.data() : {};

      // Get active package
      const packageSnapshot = await db.collection('userPackages')
        .where('userId', '==', currentUserId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      const activePackage = !packageSnapshot.empty ? packageSnapshot.docs[0].data() : null;

      // Get directs count
      const directsSnapshot = await db.collection('users')
        .where('referredByUid', '==', currentUserId)
        .get();

      // Show full email for admins, masked for regular users (isAdmin is from outer scope)
      const emailDisplay = userData.email ? (isAdmin ? userData.email : userData.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')) : 'N/A';
      
      const node = {
        uid: currentUserId,
        name: userData.name || 'N/A',
        email: emailDisplay,
        userId: userData.userId || null,
        programType: userData.programType || null,
        packageName: activePackage ? activePackage.packageName : 'None',
        plan: activePackage ? activePackage.packageName : 'None',
        status: userData.status || 'active',
        walletAvailable: walletData.availableBalance || 0,
        walletPending: walletData.pendingBalance || 0,
        directsCount: directsSnapshot.size,
        level: currentDepth,
        children: []
      };

      // Recursively get children (only first level for performance, lazy load rest)
      if (currentDepth < maxDepth) {
        const childrenPromises = directsSnapshot.docs.slice(0, 10).map(doc => 
          buildTree(doc.id, currentDepth + 1)
        );
        const children = await Promise.all(childrenPromises);
        node.children = children.filter(child => child !== null);
      }

      return node;
    }

    const tree = await buildTree(userId, 0);

    return { tree };
  } catch (error) {
    console.error('Error getting downline tree:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error getting downline tree');
  }
});

// Get Full Downline List (Admin only)
exports.getUserDownlineList = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const requestingUid = context.auth.uid;
  
  // Check if user is admin
  const userDoc = await db.collection('users').doc(requestingUid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User not found');
  }

  const userData = userDoc.data();
  const isAdmin = userData.role === 'admin' || userData.role === 'superAdmin' || 
                  context.auth.token.admin === true || context.auth.token.superAdmin === true;

  try {
    const { userId, limit = 100, startAfter = null, filters = {} } = data;

    if (!userId) {
      throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
    }

    // Allow if admin OR if requesting own downline
    if (!isAdmin && userId !== requestingUid) {
      throw new functions.https.HttpsError('permission-denied', 'You can only view your own downline list');
    }

    // Recursive function to get all downline
    async function getAllDownline(currentUserId, currentDepth, collected = []) {
      const directsSnapshot = await db.collection('users')
        .where('referredByUid', '==', currentUserId)
        .get();

      for (const doc of directsSnapshot.docs) {
        const userData = doc.data();
        
        // Apply filters
        if (filters.status && userData.status !== filters.status) continue;
        if (filters.minLevel && currentDepth < filters.minLevel) continue;
        if (filters.maxLevel && currentDepth > filters.maxLevel) continue;

        // Get wallet
        const walletDoc = await db.collection('wallets').doc(doc.id).get();
        const walletData = walletDoc.exists ? walletDoc.data() : {};

        // Get active package
        const packageSnapshot = await db.collection('userPackages')
          .where('userId', '==', doc.id)
          .where('status', '==', 'active')
          .limit(1)
          .get();

        const activePackage = !packageSnapshot.empty ? packageSnapshot.docs[0].data() : null;

        if (filters.plan && activePackage?.packageName !== filters.plan) continue;

        // Show full email for admins, masked for regular users
        const emailDisplay = userData.email ? (isAdmin ? userData.email : userData.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')) : 'N/A';
        
        collected.push({
          uid: doc.id,
          name: userData.name || 'N/A',
          email: emailDisplay,
          userId: userData.userId || null,
          programType: userData.programType || null,
          phone: userData.phone ? userData.phone.replace(/(.{2})(.*)(.{2})/, '$1***$3') : 'N/A',
          level: currentDepth,
          plan: activePackage ? activePackage.packageName : 'None',
          packageName: activePackage ? activePackage.packageName : 'None',
          activationDate: activePackage?.activatedAt || null,
          walletAvailable: walletData.availableBalance || 0,
          totalEarned: walletData.lifetimeEarned || 0,
          totalWithdrawn: walletData.lifetimeWithdrawn || 0,
          kycStatus: userData.kycVerified || false,
          bankStatus: userData.bankVerified || false,
          status: userData.status || 'active',
          createdAt: userData.createdAt || null
        });

        // Recursively get their downline
        if (collected.length < limit) {
          await getAllDownline(doc.id, currentDepth + 1, collected);
        }
      }

      return collected;
    }

    const downlineList = await getAllDownline(userId, 1, []);

    // Sort and paginate
    const sorted = downlineList.sort((a, b) => {
      if (filters.sortBy === 'level') return a.level - b.level;
      if (filters.sortBy === 'wallet') return b.walletAvailable - a.walletAvailable;
      if (filters.sortBy === 'earned') return b.totalEarned - a.totalEarned;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const paginated = sorted.slice(0, limit);

    return {
      downline: paginated,
      total: downlineList.length,
      hasMore: downlineList.length > limit
    };
  } catch (error) {
    console.error('Error getting downline list:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error getting downline list');
  }
});

// Helper function to recursively calculate downline count
async function calculateDownlineCount(userId, visited = new Set()) {
  if (visited.has(userId)) return 0; // Prevent cycles
  visited.add(userId);

  const directsSnapshot = await db.collection('users')
    .where('referredByUid', '==', userId)
    .get();

  let count = directsSnapshot.size;

  // Recursively count downline
  for (const doc of directsSnapshot.docs) {
    count += await calculateDownlineCount(doc.id, visited);
  }

  return count;
}

// Helper function to update user stats
async function updateUserStats(userId) {
  try {
    // Get directs count
    const directsSnapshot = await db.collection('users')
      .where('referredByUid', '==', userId)
      .get();
    
    const directsCount = directsSnapshot.size;

    // Calculate downline count (recursive)
    const downlineCount = await calculateDownlineCount(userId);

    // Update or create userStats document
    await db.collection('userStats').doc(userId).set({
      directsCount: directsCount,
      downlineCount: downlineCount,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { directsCount, downlineCount };
  } catch (error) {
    console.error(`Error updating user stats for ${userId}:`, error);
    throw error;
  }
}

// Update user stats when a new user is created
exports.onUserCreated = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snap, context) => {
    try {
      const userData = snap.data();
      const userId = context.params.userId;

      // Generate User ID if missing
      if (!userData.userId || !userData.userId.startsWith('MTN')) {
        try {
          const { userId: mtnUserId, userIdLower } = await generateUniqueUserId();
          const email = userData.email || '';
          const emailLower = email.toLowerCase();
          
          // Update user document and create index
          await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(userId);
            const indexRef = db.collection('userIdIndex').doc(mtnUserId);
            
            transaction.update(userRef, {
              userId: mtnUserId,
              userIdLower: userIdLower,
              emailLower: emailLower
            });
            
            // Store email in index for login lookup (avoids permission issues)
            transaction.set(indexRef, {
              uid: userId,
              email: email,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          });
        } catch (error) {
          console.error('Error auto-generating User ID in onUserCreated:', error);
          // Don't fail the entire function if User ID generation fails
        }
      }

      // If user has a referrer, update referrer's stats
      if (userData.referredByUid) {
        await updateUserStats(userData.referredByUid);

        // Also update all upline stats (cascade up)
        let currentUid = userData.referredByUid;
        const visited = new Set();

        while (currentUid && !visited.has(currentUid)) {
          visited.add(currentUid);
          await updateUserStats(currentUid);

          // Get next upline
          const uplineDoc = await db.collection('users').doc(currentUid).get();
          if (uplineDoc.exists) {
            const uplineData = uplineDoc.data();
            currentUid = uplineData.referredByUid;
          } else {
            break;
          }
        }
      }

      // Initialize stats for new user
      await db.collection('userStats').doc(userId).set({
        directsCount: 0,
        downlineCount: 0,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return null;
    } catch (error) {
      console.error('Error in onUserCreated:', error);
      return null;
    }
  });

// Update user stats when referredByUid changes
exports.onUserUpdated = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    try {
      const before = change.before.data();
      const after = change.after.data();
      const userId = context.params.userId;

      // If referredByUid changed, update stats for old and new referrers
      if (before.referredByUid !== after.referredByUid) {
        // Update old referrer's stats (if exists)
        if (before.referredByUid) {
          await updateUserStats(before.referredByUid);
        }

        // Update new referrer's stats (if exists)
        if (after.referredByUid) {
          await updateUserStats(after.referredByUid);
        }

        // Update current user's stats
        await updateUserStats(userId);
      }

      return null;
    } catch (error) {
      console.error('Error in onUserUpdated:', error);
      return null;
    }
  });

// Manual trigger to recalculate all user stats (admin only)
exports.recalculateAllUserStats = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if user is admin
  const adminDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User not found');
  }

  const adminData = adminDoc.data();
  const isAdmin = adminData.role === 'admin' || adminData.role === 'superAdmin' || 
                  context.auth.token.admin === true || context.auth.token.superAdmin === true;

  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can recalculate stats');
  }

  try {
    const usersSnapshot = await db.collection('users').get();
    let processed = 0;
    let errors = 0;

    for (const userDoc of usersSnapshot.docs) {
      try {
        await updateUserStats(userDoc.id);
        processed++;
      } catch (error) {
        console.error(`Error updating stats for ${userDoc.id}:`, error);
        errors++;
      }
    }

    return {
      success: true,
      processed,
      errors,
      message: `Processed ${processed} users, ${errors} errors`
    };
  } catch (error) {
    console.error('Error recalculating user stats:', error);
    throw new functions.https.HttpsError('internal', 'Error recalculating user stats');
  }
});

// Recalculate earning cap based on existing ledger entries (admin only)
exports.recalculateEarningCap = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if user is admin
  const adminDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User not found');
  }

  const adminData = adminDoc.data();
  const isAdmin = adminData.role === 'admin' || adminData.role === 'superAdmin' || 
                  context.auth.token.admin === true || context.auth.token.superAdmin === true;

  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can recalculate caps');
  }

  const { userId } = data;
  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
  }

  try {
    // Get renewal config
    const renewalConfig = await getRenewalConfig();
    
    // Get referral income config
    const referralConfigDoc = await db.collection('adminConfig').doc('referralIncome').get();
    const referralConfig = referralConfigDoc.exists ? referralConfigDoc.data() : {};

    // Get active package
    const activePackage = await getActivePackage(userId);
    if (!activePackage) {
      throw new functions.https.HttpsError('failed-precondition', 'User has no active package');
    }

    const cycleNumber = activePackage.cycleNumber || 1;

    // Get all income ledger entries for this user
    const ledgerEntriesSnapshot = await db.collection('incomeLedger').doc(userId)
      .collection('entries')
      .where('status', 'in', ['APPROVED', 'approved', 'completed', 'COMPLETED'])
      .get();

    let eligibleEarningsTotal = 0;

    // Sum up all eligible income
    for (const entryDoc of ledgerEntriesSnapshot.docs) {
      const entry = entryDoc.data();
      const incomeType = entry.type;
      const amount = entry.amount || 0;

      // Check if income type is eligible (support REFERRAL_DIRECT, REFERRAL_LEVEL, and direct_referral)
      const isEligibleType = renewalConfig.eligibleIncomeTypes?.includes(incomeType) ||
        (incomeType === 'REFERRAL_DIRECT' && renewalConfig.eligibleIncomeTypes?.includes('direct_referral')) ||
        (incomeType === 'direct_referral' && renewalConfig.eligibleIncomeTypes?.includes('REFERRAL_DIRECT')) ||
        (incomeType === 'REFERRAL_LEVEL' && (renewalConfig.eligibleIncomeTypes?.includes('REFERRAL_DIRECT') || 
                                             renewalConfig.eligibleIncomeTypes?.includes('direct_referral')));

      if (!isEligibleType) {
        continue; // Skip non-eligible income types
      }

      // For referral income (direct or level), check if it counts toward cap
      if (incomeType === 'REFERRAL_DIRECT' || incomeType === 'REFERRAL_LEVEL' || incomeType === 'direct_referral') {
        const countsTowardCap = entry.metadata?.countsTowardCap !== false && 
                                (referralConfig.referralIncomeCountsTowardCap !== false);
        if (!countsTowardCap) {
          continue; // Skip if referral income doesn't count toward cap
        }
      }

      eligibleEarningsTotal += amount;
    }

    // Get or create cap tracker
    const capTracker = await getEarningCap(userId, cycleNumber);
    if (!capTracker) {
      throw new functions.https.HttpsError('failed-precondition', 'Could not create cap tracker');
    }

    const remaining = Math.max(0, capTracker.capAmountInr - eligibleEarningsTotal);
    const capReached = eligibleEarningsTotal >= capTracker.capAmountInr;

    // Update cap tracker
    await db.collection('earningCaps').doc(capTracker.id).update({
      eligibleEarningsTotalInr: eligibleEarningsTotal,
      remainingInr: remaining,
      capStatus: capReached ? 'CAP_REACHED' : 'ACTIVE',
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update package status if cap reached
    if (capReached && renewalConfig.autoMarkCapReached && activePackage.capStatus !== 'CAP_REACHED') {
      await db.collection('userPackages').doc(activePackage.id).update({
        capStatus: 'CAP_REACHED',
        capReachedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Create audit log
    await db.collection('auditLogs').add({
      action: 'cap_recalculated',
      userId: userId,
      cycleNumber: cycleNumber,
      eligibleEarningsTotal: eligibleEarningsTotal,
      capAmount: capTracker.capAmountInr,
      capStatus: capReached ? 'CAP_REACHED' : 'ACTIVE',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      performedBy: context.auth.uid,
      performedByEmail: adminData.email
    });

    return {
      success: true,
      userId: userId,
      cycleNumber: cycleNumber,
      eligibleEarningsTotal: eligibleEarningsTotal,
      capAmount: capTracker.capAmountInr,
      remaining: remaining,
      capStatus: capReached ? 'CAP_REACHED' : 'ACTIVE',
      message: `Cap recalculated successfully. Earned: ${eligibleEarningsTotal}, Cap: ${capTracker.capAmountInr}, Remaining: ${remaining}`
    };
  } catch (error) {
    console.error('Error recalculating cap:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error recalculating cap');
  }
});

// 7-Day Activation Auto-Block - Runs daily
exports.autoBlockInactiveUsers = functions.pubsub.schedule('0 0 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('Starting auto-block check for inactive users...');
    
    try {
      // Get activation rules config
      const activationConfigDoc = await db.collection('adminConfig').doc('activationRules').get();
      const activationConfig = activationConfigDoc.exists ? activationConfigDoc.data() : {
        activationWindowDays: 7,
        autoBlockEnabled: true,
        blockType: 'soft' // 'soft' or 'hard'
      };
      
      if (!activationConfig.autoBlockEnabled) {
        console.log('Auto-block is disabled. Skipping.');
        return null;
      }
      
      const activationWindowDays = activationConfig.activationWindowDays || 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - activationWindowDays);
      const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);
      
      // Find users with status PENDING_ACTIVATION and created before cutoff
      const pendingUsersSnapshot = await db.collection('users')
        .where('status', '==', 'PENDING_ACTIVATION')
        .where('createdAt', '<', cutoffTimestamp)
        .get();
      
      if (pendingUsersSnapshot.empty) {
        console.log('No users to auto-block.');
        return null;
      }
      
      let blockedCount = 0;
      
      for (const userDoc of pendingUsersSnapshot.docs) {
        try {
          const userData = userDoc.data();
          
          // Skip if already has active package
          const activePackageSnapshot = await db.collection('userPackages')
            .where('userId', '==', userDoc.id)
            .where('status', '==', 'active')
            .limit(1)
            .get();
          
          if (!activePackageSnapshot.empty) {
            // User has active package, update status
            await userDoc.ref.update({
              status: userData.programType === 'leader' ? 'ACTIVE_LEADER' : 'ACTIVE_INVESTOR',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            continue;
          }
          
          // Block the user
          await userDoc.ref.update({
            status: 'AUTO_BLOCKED',
            autoBlockedAt: admin.firestore.FieldValue.serverTimestamp(),
            autoBlockReason: `Not activated within ${activationWindowDays} days`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          // Create audit log
          await db.collection('auditLogs').add({
            action: 'user_auto_blocked',
            userId: userDoc.id,
            reason: `Not activated within ${activationWindowDays} days`,
            blockType: activationConfig.blockType,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            performedBy: 'system'
          });
          
          blockedCount++;
          console.log(`Auto-blocked user ${userDoc.id} - not activated within ${activationWindowDays} days`);
        } catch (error) {
          console.error(`Error blocking user ${userDoc.id}:`, error);
        }
      }
      
      console.log(`Auto-block completed. Blocked ${blockedCount} users.`);
      return { blockedCount };
      
    } catch (error) {
      console.error('Error in auto-block function:', error);
      throw error;
    }
  });

// Manual Referral Income Processing (Admin only)
// Use this to process referral income for existing activations that didn't trigger automatically
exports.manualProcessReferralIncome = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if user is admin
  const adminDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User not found');
  }

  const adminData = adminDoc.data();
  const isAdmin = adminData.role === 'admin' || adminData.role === 'superAdmin' || 
                  context.auth.token.admin === true || context.auth.token.superAdmin === true;

  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can process referral income');
  }

  try {
    const { refereeUid } = data;

    if (!refereeUid) {
      throw new functions.https.HttpsError('invalid-argument', 'refereeUid is required');
    }

    // Get referee user data
    const refereeDoc = await db.collection('users').doc(refereeUid).get();
    if (!refereeDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Referee user not found');
    }

    const refereeData = refereeDoc.data();

    // Check if referee has an active Investor package
    const activePackages = await db.collection('userPackages')
      .where('userId', '==', refereeUid)
      .where('status', '==', 'active')
      .where('packageId', '!=', 'LEADER_PROGRAM')
      .get();

    if (activePackages.empty) {
      throw new functions.https.HttpsError('failed-precondition', 'Referee has no active Investor package');
    }

    // Get the first active Investor package
    const activePackage = activePackages.docs[0].data();
    const activationAmount = activePackage.amount || activePackage.inrPrice || 0;

    // Check if referee is Investor
    if (refereeData.programType !== 'investor' || refereeData.status !== 'ACTIVE_INVESTOR') {
      throw new functions.https.HttpsError('failed-precondition', 'Referee must be ACTIVE_INVESTOR');
    }

    // Get referrer
    if (!refereeData.referredByUid) {
      throw new functions.https.HttpsError('failed-precondition', 'Referee has no referrer');
    }

    const referrerId = refereeData.referredByUid;
    const referrerDoc = await db.collection('users').doc(referrerId).get();

    if (!referrerDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Referrer not found');
    }

    const referrerData = referrerDoc.data();

    // Check if referrer is Investor
    if (referrerData.programType !== 'investor' || referrerData.status !== 'ACTIVE_INVESTOR') {
      throw new functions.https.HttpsError('failed-precondition', 
        `Referrer must be ACTIVE_INVESTOR. Current status: ${referrerData.status}, programType: ${referrerData.programType}`);
    }

    // Get referral income config
    const referralConfigDoc = await db.collection('adminConfig').doc('referralIncome').get();
    const referralConfig = referralConfigDoc.exists ? referralConfigDoc.data() : {
      enableReferralIncomeGlobal: true,
      enableInvestorReferralIncome: true,
      directReferralPercent: 5.0,
      referralIncomePayoutMode: 'INSTANT_TO_WALLET',
      referralIncomeCountsTowardCap: true
    };

    // Check if referral income is enabled
    if (!referralConfig.enableReferralIncomeGlobal || !referralConfig.enableInvestorReferralIncome) {
      throw new functions.https.HttpsError('failed-precondition', 'Referral income is disabled');
    }

    // Use the same distribution function to ensure multi-level income is also processed
    const userPackageDoc = activePackages.docs[0];
    const packageId = userPackageDoc.id;
    const packageData = userPackageDoc.data();
    
    const result = await distributeReferralIncomeForActivation(
      refereeUid,
      packageId,
      activationAmount,
      {
        packageId: packageData.packageId || packageId,
        amount: activationAmount,
        inrPrice: activationAmount
      }
    );

    if (!result.success) {
      throw new functions.https.HttpsError('failed-precondition', 
        `Failed to process referral income: ${result.reason || 'Unknown error'}`);
    }

    // Create audit log
    await db.collection('auditLogs').add({
      action: 'manual_referral_income_processed',
      referrerUid: result.directReferrerId,
      refereeUid: refereeUid,
      directAmount: result.directAmount || 0,
      levelAmount: result.levelAmount || 0,
      totalAmount: result.totalAmount || 0,
      activationAmount: activationAmount,
      packageId: packageId,
      levelResults: result.levelResults || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      performedBy: context.auth.uid,
      performedByEmail: adminData.email
    });

    return { 
      success: true, 
      message: `Referral income processed successfully. Direct: ${result.directAmount || 0}, Levels: ${result.levelAmount || 0}, Total: ${result.totalAmount || 0}`,
      directAmount: result.directAmount,
      levelAmount: result.levelAmount,
      totalAmount: result.totalAmount,
      directReferrerId: result.directReferrerId
    };

  } catch (error) {
    console.error('Error in manual referral income processing:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error processing referral income');
  }
});

// Process referral income for all existing activations (Admin only)
// This function processes referral income for all ACTIVE_INVESTOR users who have active packages
// but haven't received referral income yet
exports.processAllPendingReferralIncome = functions.runWith({
  timeoutSeconds: 540, // 9 minutes max
  memory: '512MB'
}).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if user is admin
  const adminDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User not found');
  }

  const adminData = adminDoc.data();
  const isAdmin = adminData.role === 'admin' || adminData.role === 'superAdmin' || 
                  context.auth.token.admin === true || context.auth.token.superAdmin === true;

  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can process all referral income');
  }

  try {
    const { forceReprocess = false } = data || {};
    console.log(`Starting bulk referral income processing... (forceReprocess: ${forceReprocess})`);

    // Get all ACTIVE_INVESTOR users with active Investor packages
    // Use separate queries to avoid compound index issues
    let activeInvestorsSnapshot;
    try {
      activeInvestorsSnapshot = await db.collection('users')
        .where('status', '==', 'ACTIVE_INVESTOR')
        .get();
    } catch (error) {
      console.error('Error fetching users:', error);
      // Fallback: get all users and filter in code
      activeInvestorsSnapshot = await db.collection('users').get();
    }

    if (activeInvestorsSnapshot.empty) {
      return { success: true, processed: 0, message: 'No users found' };
    }

    // Filter to only investors
    const investorDocs = activeInvestorsSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.programType === 'investor' && data.status === 'ACTIVE_INVESTOR';
    });

    if (investorDocs.length === 0) {
      return { success: true, processed: 0, message: 'No active investors found' };
    }

    console.log(`Found ${investorDocs.length} active investors to process`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const results = [];
    const errors = [];
    const skipReasons = {
      noReferrer: 0,
      noActivePackages: 0,
      alreadyProcessed: 0,
      referrerNotActiveInvestor: 0,
      referrerNotFound: 0,
      zeroAmount: 0,
      other: 0
    };

    for (const userDoc of investorDocs) {
      try {
        const userId = userDoc.id;
        const userData = userDoc.data();

        // Skip if user has no referrer
        if (!userData.referredByUid) {
          skipReasons.noReferrer++;
          skippedCount++;
          console.log(`Skipping user ${userId} - no referrer`);
          continue;
        }

        // Get active Investor packages for this user
        let activePackages;
        try {
          activePackages = await db.collection('userPackages')
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .get();
        } catch (error) {
          console.error(`Error fetching packages for user ${userId}:`, error);
          errorCount++;
          errors.push({ userId, error: 'Failed to fetch packages' });
          continue;
        }

        // Filter out Leader Program packages
        const investorPackages = activePackages.docs.filter(pkg => {
          const pkgData = pkg.data();
          return pkgData.packageId !== 'LEADER_PROGRAM';
        });

        if (investorPackages.length === 0) {
          skipReasons.noActivePackages++;
          skippedCount++;
          console.log(`Skipping user ${userId} - no active Investor packages`);
          continue;
        }

        // Process each active package
        for (const packageDoc of investorPackages) {
          try {
            const packageData = packageDoc.data();
            const packageId = packageDoc.id;
            const activationAmount = packageData.amount || packageData.inrPrice || 0;

            if (activationAmount <= 0) {
              skipReasons.zeroAmount++;
              skippedCount++;
              console.log(`Skipping user ${userId} package ${packageId} - zero activation amount`);
              continue;
            }

            // Check if referral income already processed
            // Only skip if APPROVED/COMPLETED income exists (not PENDING or REJECTED)
            const referrerId = userData.referredByUid;
            let existingIncome = { empty: true };
            
            try {
              // Check for REFERRAL_DIRECT with APPROVED/COMPLETED status
              const directIncome = await db.collection('incomeLedger').doc(referrerId).collection('entries')
                .where('type', '==', 'REFERRAL_DIRECT')
                .where('metadata.sourceUid', '==', userId)
                .where('status', 'in', ['APPROVED', 'approved', 'COMPLETED', 'completed'])
                .limit(1)
                .get();
              
              if (!directIncome.empty) {
                existingIncome = directIncome;
              } else {
                // Check for REFERRAL_LEVEL with APPROVED/COMPLETED status
                const levelIncome = await db.collection('incomeLedger').doc(referrerId).collection('entries')
                  .where('type', '==', 'REFERRAL_LEVEL')
                  .where('metadata.sourceUid', '==', userId)
                  .where('status', 'in', ['APPROVED', 'approved', 'COMPLETED', 'completed'])
                  .limit(1)
                  .get();
                
                if (!levelIncome.empty) {
                  existingIncome = levelIncome;
                }
              }
            } catch (error) {
              console.error(`Error checking existing income for user ${userId}:`, error);
              // If query fails (e.g., missing index), check without status filter
              try {
                const directIncome = await db.collection('incomeLedger').doc(referrerId).collection('entries')
                  .where('type', '==', 'REFERRAL_DIRECT')
                  .where('metadata.sourceUid', '==', userId)
                  .limit(1)
                  .get();
                
                if (!directIncome.empty) {
                  const entry = directIncome.docs[0].data();
                  // Only skip if status is APPROVED/COMPLETED
                  if (entry.status === 'APPROVED' || entry.status === 'approved' || 
                      entry.status === 'COMPLETED' || entry.status === 'completed') {
                    existingIncome = directIncome;
                  }
                }
              } catch (fallbackError) {
                console.error(`Fallback check also failed for user ${userId}:`, fallbackError);
                // Continue processing even if check fails - better to process than skip
              }
            }

            if (!existingIncome.empty && !forceReprocess) {
              // Check if wallet was actually credited by verifying the entry amount matches wallet balance
              // If entry exists but wallet wasn't credited, we should reprocess
              const entry = existingIncome.docs[0].data();
              const entryAmount = entry.amount || 0;
              
              // Get referrer's wallet to check if it was credited
              try {
                const walletDoc = await db.collection('wallets').doc(referrerId).get();
                if (walletDoc.exists) {
                  const walletData = walletDoc.data();
                  const availableBalance = walletData.availableBalance || 0;
                  
                  // Check if there's a matching ledger entry that was credited
                  // If the entry exists but wallet seems low, it might not have been credited properly
                  // For now, we'll still skip if entry is APPROVED, but log a warning
                  console.log(`User ${userId}: Entry exists (${entryAmount}), Referrer ${referrerId} wallet: ${availableBalance}`);
                }
              } catch (walletError) {
                console.error(`Error checking wallet for referrer ${referrerId}:`, walletError);
              }
              
              skipReasons.alreadyProcessed++;
              skippedCount++;
              console.log(`Skipping user ${userId} - referral income already exists and is APPROVED/COMPLETED`);
              continue;
            } else if (!existingIncome.empty && forceReprocess) {
              console.log(`Force reprocessing user ${userId} - will create new entries even though existing ones found`);
              // Continue to process - the distribution function has its own duplicate check
            }

            // Verify referrer exists and is ACTIVE_INVESTOR before processing
            let referrerDoc;
            try {
              referrerDoc = await db.collection('users').doc(referrerId).get();
              if (!referrerDoc.exists) {
                skipReasons.referrerNotFound++;
                skippedCount++;
                console.log(`Skipping user ${userId} - referrer ${referrerId} not found`);
                continue;
              }
              
              const referrerData = referrerDoc.data();
              if (referrerData.programType !== 'investor' || referrerData.status !== 'ACTIVE_INVESTOR') {
                skipReasons.referrerNotActiveInvestor++;
                skippedCount++;
                console.log(`Skipping user ${userId} - referrer ${referrerId} is not ACTIVE_INVESTOR (status: ${referrerData.status}, programType: ${referrerData.programType})`);
                continue;
              }
            } catch (error) {
              errorCount++;
              console.error(`Error checking referrer for user ${userId}:`, error);
              errors.push({ userId, error: `Failed to check referrer: ${error.message}` });
              continue;
            }

            // Process referral income
            try {
              const result = await distributeReferralIncomeForActivation(
                userId,
                packageId,
                activationAmount,
                {
                  packageId: packageData.packageId || packageId,
                  amount: activationAmount,
                  inrPrice: activationAmount
                }
              );

              if (result.success) {
                processedCount++;
                results.push({
                  userId,
                  referrerId: result.directReferrerId,
                  directAmount: result.directAmount,
                  levelAmount: result.levelAmount,
                  totalAmount: result.totalAmount
                });
                console.log(`Processed referral income for user ${userId}: Direct: ${result.directAmount}, Levels: ${result.levelAmount}`);
              } else {
                skippedCount++;
                console.log(`Skipped user ${userId}: ${result.reason}`);
              }
            } catch (error) {
              errorCount++;
              const errorMsg = error.message || String(error);
              console.error(`Error processing referral income for user ${userId}:`, errorMsg);
              errors.push({ userId, error: errorMsg });
            }
          } catch (error) {
            errorCount++;
            const errorMsg = error.message || String(error);
            console.error(`Error processing package for user ${userId}:`, errorMsg);
            errors.push({ userId, error: errorMsg });
          }
        }
      } catch (error) {
        errorCount++;
        const errorMsg = error.message || String(error);
        console.error(`Error processing user ${userDoc.id}:`, errorMsg);
        errors.push({ userId: userDoc.id, error: errorMsg });
      }
    }

    // Create audit log
    try {
      await db.collection('auditLogs').add({
        action: 'bulk_referral_income_processed',
        processedCount,
        skippedCount,
        errorCount,
        results: results.slice(0, 100), // Limit results in audit log
        errors: errors.slice(0, 50), // Limit errors in audit log
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        performedBy: context.auth.uid,
        performedByEmail: adminData.email
      });
    } catch (auditError) {
      console.error('Error creating audit log:', auditError);
      // Don't fail the function if audit log fails
    }

    return {
      success: true,
      processed: processedCount,
      skipped: skippedCount,
      errors: errorCount,
      message: `Processed ${processedCount} referral income distributions. Skipped: ${skippedCount}, Errors: ${errorCount}`,
      errorDetails: errors.slice(0, 10), // Return first 10 errors for debugging
      skipReasons: skipReasons // Detailed breakdown of why users were skipped
    };

  } catch (error) {
    console.error('Error in bulk referral income processing:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error processing bulk referral income');
  }
});

// Sync wallet balances from users collection to wallets collection (Admin only)
// This migrates existing balances from users.walletBalance to wallets.availableBalance
exports.syncWalletBalances = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Check if user is admin
  const adminDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User not found');
  }

  const adminData = adminDoc.data();
  const isAdmin = adminData.role === 'admin' || adminData.role === 'superAdmin' || 
                  context.auth.token.admin === true || context.auth.token.superAdmin === true;

  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can sync wallet balances');
  }

  try {
    console.log('Starting wallet balance sync...');

    // Get all users
    const usersSnapshot = await db.collection('users').get();

    if (usersSnapshot.empty) {
      return { success: true, synced: 0, message: 'No users found' };
    }

    let syncedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      const walletBalance = userData.walletBalance || 0;
      const pendingBalance = userData.pendingBalance || 0;
      const totalIncome = userData.totalIncome || 0;
      const lifetimeEarned = userData.lifetimeEarned || totalIncome || 0;
      const lifetimeWithdrawn = userData.lifetimeWithdrawn || 0;

      // Skip if all balances are zero and wallet doesn't exist
      if (walletBalance === 0 && pendingBalance === 0 && lifetimeEarned === 0 && lifetimeWithdrawn === 0) {
        const walletDoc = await db.collection('wallets').doc(userId).get();
        if (!walletDoc.exists) {
          skippedCount++;
          continue;
        }
      }

      // Get or create wallet document
      const walletRef = db.collection('wallets').doc(userId);
      const walletDoc = await walletRef.get();

      if (walletDoc.exists) {
        // Update existing wallet - use the higher value (users collection or wallets collection)
        const existingAvailable = walletDoc.data().availableBalance || 0;
        const existingPending = walletDoc.data().pendingBalance || 0;
        const existingLifetimeEarned = walletDoc.data().lifetimeEarned || 0;
        const existingLifetimeWithdrawn = walletDoc.data().lifetimeWithdrawn || 0;

        // Use the maximum value to avoid losing data
        const newAvailable = Math.max(existingAvailable, walletBalance);
        const newPending = Math.max(existingPending, pendingBalance);
        const newLifetimeEarned = Math.max(existingLifetimeEarned, lifetimeEarned);
        const newLifetimeWithdrawn = Math.max(existingLifetimeWithdrawn, lifetimeWithdrawn);

        await walletRef.update({
          availableBalance: newAvailable,
          pendingBalance: newPending,
          lifetimeEarned: newLifetimeEarned,
          lifetimeWithdrawn: newLifetimeWithdrawn,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        updatedCount++;
      } else {
        // Create new wallet document
        await walletRef.set({
          availableBalance: walletBalance,
          pendingBalance: pendingBalance,
          lifetimeEarned: lifetimeEarned,
          lifetimeWithdrawn: lifetimeWithdrawn,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        createdCount++;
      }

      syncedCount++;
    }

    // Create audit log
    await db.collection('auditLogs').add({
      action: 'wallet_balances_synced',
      syncedCount,
      createdCount,
      updatedCount,
      skippedCount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      performedBy: context.auth.uid,
      performedByEmail: adminData.email
    });

    return {
      success: true,
      synced: syncedCount,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      message: `Synced ${syncedCount} wallet balances. Created: ${createdCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`
    };

  } catch (error) {
    console.error('Error syncing wallet balances:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error syncing wallet balances');
  }
});

// Helper function to generate unique MTN User ID
async function generateUniqueUserId() {
  const maxAttempts = 10;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    // Generate random 6-digit number (000000-999999)
    const randomNum = Math.floor(Math.random() * 1000000);
    const userId = `MTN${String(randomNum).padStart(6, '0')}`;
    const userIdLower = userId.toLowerCase();
    
    // Check if userId already exists in index
    const indexDoc = await db.collection('userIdIndex').doc(userId).get();
    
    if (!indexDoc.exists) {
      // Reserve this userId using a transaction
      const indexRef = db.collection('userIdIndex').doc(userId);
      
      try {
        await db.runTransaction(async (transaction) => {
          const indexSnapshot = await transaction.get(indexRef);
          
          if (!indexSnapshot.exists) {
            // Reserve it temporarily (will be updated with actual uid)
            transaction.set(indexRef, {
              reserved: true,
              reservedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return userId;
          } else {
            throw new Error('UserId already exists');
          }
        });
        
        return { userId, userIdLower };
      } catch (error) {
        // If transaction failed, try again
        attempts++;
        continue;
      }
    }
    
    attempts++;
  }
  
  throw new Error('Failed to generate unique User ID after maximum attempts');
}

// Generate MTN User ID for a user
exports.generateUserId = functions.https.onCall(async (data, context) => {
  try {
    // Require authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const uid = context.auth.uid;
    
    // Check if user already has a userId
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User document not found');
    }
    
    const userData = userDoc.data();
    if (userData.userId && userData.userId.startsWith('MTN')) {
      return {
        success: true,
        userId: userData.userId,
        message: 'User ID already exists'
      };
    }
    
    // Generate unique userId
    const { userId, userIdLower } = await generateUniqueUserId();
    
    // Get user email for emailLower
    const email = userData.email || context.auth.token.email || '';
    const emailLower = email.toLowerCase();
    
    // Update user document and index in a transaction
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(uid);
      const indexRef = db.collection('userIdIndex').doc(userId);
      
      // Update user document
      transaction.update(userRef, {
        userId: userId,
        userIdLower: userIdLower,
        emailLower: emailLower
      });
      
      // Update index with actual uid and email for login lookup
      transaction.set(indexRef, {
        uid: uid,
        email: email,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    return {
      success: true,
      userId: userId,
      message: 'User ID generated successfully'
    };
    
  } catch (error) {
    console.error('Error generating User ID:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error generating User ID: ' + error.message);
  }
});

// Ensure User ID exists (backfill for existing users)
exports.ensureUserId = functions.https.onCall(async (data, context) => {
  try {
    // Require authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const uid = context.auth.uid;
    
    // Check if user has userId
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User document not found');
    }
    
    const userData = userDoc.data();
    
    // If userId already exists, return it
    if (userData.userId && userData.userId.startsWith('MTN')) {
      return {
        success: true,
        userId: userData.userId,
        alreadyExists: true
      };
    }
    
    // Generate userId (reuse the logic)
    const { userId, userIdLower } = await generateUniqueUserId();
    
    // Get user email for emailLower
    const email = userData.email || context.auth.token.email || '';
    const emailLower = email.toLowerCase();
    
    // Update user document and index in a transaction
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(uid);
      const indexRef = db.collection('userIdIndex').doc(userId);
      
      // Update user document
      transaction.update(userRef, {
        userId: userId,
        userIdLower: userIdLower,
        emailLower: emailLower
      });
      
      // Update index with actual uid and email for login lookup
      transaction.set(indexRef, {
        uid: uid,
        email: email,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    return {
      success: true,
      userId: userId,
      alreadyExists: false
    };
    
  } catch (error) {
    console.error('Error ensuring User ID:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error ensuring User ID: ' + error.message);
  }
});

// Create Payout Record (Admin only)
exports.createPayout = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const adminDoc = await db.collection('users').doc(context.auth.uid).get();
  const adminData = adminDoc.data();
  
  if (!adminData || (adminData.role !== 'superAdmin' && adminData.role !== 'admin' && adminData.role !== 'subAdmin')) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can create payouts');
  }

  // Check sub-admin permissions
  if (adminData.role === 'subAdmin') {
    const permissions = adminData.permissions || {};
    const payoutPerms = permissions.payoutReports || {};
    if (!payoutPerms.create) {
      throw new functions.https.HttpsError('permission-denied', 'You do not have permission to create payouts');
    }
  }

  try {
    const { memberUid, memberId, memberName, amount, paymentDate, mode, remark, proofUrl } = data;

    if (!memberUid || !amount || !paymentDate) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    // Validate member has enough balance
    const summaryDoc = await db.collection('reportUserSummary').doc(memberUid).get();
    let balanceToBePaid = 0;
    
    if (summaryDoc.exists) {
      balanceToBePaid = summaryDoc.data().balanceToBePaid || 0;
    } else {
      // Calculate from existing data if summary doesn't exist
      const userDoc = await db.collection('users').doc(memberUid).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Member not found');
      }

      // Get income entries
      const entriesRef = db.collection('incomeLedger').doc(memberUid).collection('entries');
      const entriesSnapshot = await entriesRef.get();
      
      let totalIncome = 0;
      entriesSnapshot.forEach(doc => {
        totalIncome += doc.data().amount || 0;
      })

      // Get withdrawals (paid amounts)
      const withdrawalsSnapshot = await db.collection('withdrawals')
        .where('uid', '==', memberUid)
        .where('status', '==', 'paid')
        .get();
      
      let amountPaid = 0;
      withdrawalsSnapshot.forEach(doc => {
        amountPaid += doc.data().amountRequested || doc.data().netAmount || 0;
      });

      const netAmount = totalIncome - (totalIncome * 0.15); // 15% deductions
      balanceToBePaid = netAmount - amountPaid;
    }

    if (balanceToBePaid < amount) {
      throw new functions.https.HttpsError('failed-precondition', 'Insufficient balance');
    }

    // Create payout record
    const payoutRef = db.collection('payouts').doc();
    const payoutData = {
      memberUid,
      memberId: memberId || memberUid,
      memberName: memberName || 'Unknown',
      amount: parseFloat(amount),
      paymentDate: admin.firestore.Timestamp.fromDate(new Date(paymentDate)),
      mode: mode || 'Bank Transfer',
      remark: remark || '',
      proofUrl: proofUrl || '',
      status: 'PAID',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: context.auth.uid
    };

    await payoutRef.set(payoutData);

    // Update summary (refresh to get latest data)
    const summaryRef = db.collection('reportUserSummary').doc(memberUid);
    const updatedSummaryDoc = await summaryRef.get();
    
    if (updatedSummaryDoc.exists) {
      const currentData = updatedSummaryDoc.data();
      await summaryRef.update({
        amountPaid: (currentData.amountPaid || 0) + parseFloat(amount),
        balanceToBePaid: (currentData.balanceToBePaid || 0) - parseFloat(amount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // Create summary if it doesn't exist
      const userDoc = await db.collection('users').doc(memberUid).get();
      const userData = userDoc.data();
      
      // Calculate totals
      const entriesRef = db.collection('incomeLedger').doc(memberUid).collection('entries');
      const entriesSnapshot = await entriesRef.get();
      
      let totalIncome = 0;
      entriesSnapshot.forEach(doc => {
        totalIncome += doc.data().amount || 0;
      });

      const netAmount = totalIncome - (totalIncome * 0.15);
      const amountPaid = parseFloat(amount);
      const balanceToBePaid = netAmount - amountPaid;

      await summaryRef.set({
        memberId: userData?.userId || memberUid,
        name: userData?.name || memberName || 'Unknown',
        mobile: userData?.phone || '',
        bank: userData?.bank || {},
        netAmount,
        amountPaid,
        balanceToBePaid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Add audit log
    await db.collection('auditLogs').add({
      action: 'CREATE_PAYOUT',
      adminUid: context.auth.uid,
      adminName: adminData.name || 'Unknown',
      targetUid: memberUid,
      targetName: memberName,
      amount: parseFloat(amount),
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, payoutId: payoutRef.id };
  } catch (error) {
    console.error('Error creating payout:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error creating payout: ' + error.message);
  }
});

// Cancel Payout (SuperAdmin only)
exports.cancelPayout = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const adminDoc = await db.collection('users').doc(context.auth.uid).get();
  const adminData = adminDoc.data();
  
  if (!adminData || adminData.role !== 'superAdmin') {
    throw new functions.https.HttpsError('permission-denied', 'Only super admin can cancel payouts');
  }

  try {
    const { payoutId } = data;

    if (!payoutId) {
      throw new functions.https.HttpsError('invalid-argument', 'Payout ID is required');
    }

    // Get payout record
    const payoutDoc = await db.collection('payouts').doc(payoutId).get();
    if (!payoutDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Payout not found');
    }

    const payoutData = payoutDoc.data();
    
    if (payoutData.status === 'CANCELLED') {
      throw new functions.https.HttpsError('failed-precondition', 'Payout is already cancelled');
    }

    // Mark payout as cancelled
    await payoutDoc.ref.update({
      status: 'CANCELLED',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      cancelledBy: context.auth.uid
    });

    // Reverse summary values
    const summaryRef = db.collection('reportUserSummary').doc(payoutData.memberUid);
    const summaryDoc = await summaryRef.get();
    
    if (summaryDoc.exists) {
      const currentData = summaryDoc.data();
      await summaryRef.update({
        amountPaid: Math.max(0, (currentData.amountPaid || 0) - payoutData.amount),
        balanceToBePaid: (currentData.balanceToBePaid || 0) + payoutData.amount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Add audit log
    await db.collection('auditLogs').add({
      action: 'CANCEL_PAYOUT',
      adminUid: context.auth.uid,
      adminName: adminData.name || 'Unknown',
      targetUid: payoutData.memberUid,
      targetName: payoutData.memberName,
      amount: payoutData.amount,
      payoutId,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error cancelling payout:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error cancelling payout: ' + error.message);
  }
});

// Delete User and All Related Data (Admin only)
exports.deleteUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const adminDoc = await db.collection('users').doc(context.auth.uid).get();
  const adminData = adminDoc.data();
  
  if (!adminData || (adminData.role !== 'superAdmin' && adminData.role !== 'admin')) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can delete users');
  }

  try {
    const { userId } = data;

    if (!userId) {
      throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
    }

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const userData = userDoc.data();
    const batch = db.batch();

    // 1. Delete user document
    batch.delete(db.collection('users').doc(userId));

    // 2. Delete wallet
    const walletRef = db.collection('wallets').doc(userId);
    const walletDoc = await walletRef.get();
    if (walletDoc.exists) {
      batch.delete(walletRef);
    }

    // 3. Delete all user packages
    const packagesSnapshot = await db.collection('userPackages')
      .where('userId', '==', userId)
      .get();
    packagesSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 4. Delete all withdrawals
    const withdrawalsSnapshot = await db.collection('withdrawals')
      .where('uid', '==', userId)
      .get();
    withdrawalsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 5. Delete all transfers (as sender or recipient)
    const transfersAsSender = await db.collection('transfers')
      .where('senderUid', '==', userId)
      .get();
    transfersAsSender.forEach(doc => {
      batch.delete(doc.ref);
    });

    const transfersAsRecipient = await db.collection('transfers')
      .where('recipientUid', '==', userId)
      .get();
    transfersAsRecipient.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 6. Delete income ledger entries (subcollection)
    const incomeLedgerRef = db.collection('incomeLedger').doc(userId);
    const incomeLedgerDoc = await incomeLedgerRef.get();
    if (incomeLedgerDoc.exists) {
      const entriesSnapshot = await incomeLedgerRef.collection('entries').get();
      entriesSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      batch.delete(incomeLedgerRef);
    }

    // 7. Delete user financial profile and banks subcollection
    const financialProfileRef = db.collection('userFinancialProfiles').doc(userId);
    const financialProfileDoc = await financialProfileRef.get();
    if (financialProfileDoc.exists) {
      // Delete banks subcollection
      const banksSnapshot = await financialProfileRef.collection('banks').get();
      banksSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      batch.delete(financialProfileRef);
    }

    // 8. Delete report user summary
    const reportSummaryRef = db.collection('reportUserSummary').doc(userId);
    const reportSummaryDoc = await reportSummaryRef.get();
    if (reportSummaryDoc.exists) {
      batch.delete(reportSummaryRef);
    }

    // 9. Delete payouts
    const payoutsSnapshot = await db.collection('payouts')
      .where('memberUid', '==', userId)
      .get();
    payoutsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 10. Delete activations
    const activationsSnapshot = await db.collection('activations')
      .where('targetUid', '==', userId)
      .get();
    activationsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    const activationsAsSponsor = await db.collection('activations')
      .where('sponsorUid', '==', userId)
      .get();
    activationsAsSponsor.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 11. Update referredByUid for users who were referred by this user (set to null or remove)
    const referredUsersSnapshot = await db.collection('users')
      .where('referredByUid', '==', userId)
      .get();
    referredUsersSnapshot.forEach(doc => {
      batch.update(doc.ref, { referredByUid: null });
    });

    // 12. Delete user stats
    const userStatsRef = db.collection('userStats').doc(userId);
    const userStatsDoc = await userStatsRef.get();
    if (userStatsDoc.exists) {
      batch.delete(userStatsRef);
    }

    // 13. Delete audit logs related to this user
    const auditLogsSnapshot = await db.collection('auditLogs')
      .where('targetUid', '==', userId)
      .get();
    auditLogsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Commit all deletions
    await batch.commit();

    // Add audit log for deletion
    await db.collection('auditLogs').add({
      action: 'DELETE_USER',
      adminUid: context.auth.uid,
      adminName: adminData.name || 'Unknown',
      targetUid: userId,
      targetName: userData.name || userData.email || 'Unknown',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, message: 'User and all related data deleted successfully' };
  } catch (error) {
    console.error('Error deleting user:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Error deleting user: ' + error.message);
  }
});

// Auto-generate User ID when user document is created (if missing)

