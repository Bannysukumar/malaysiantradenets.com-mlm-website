# Income Distribution System - Implementation Guide

## ✅ **IMPLEMENTATION COMPLETE**

The automatic income distribution system has been implemented using Firebase Cloud Functions.

## 📋 What's Implemented

### 1. **Daily ROI Distribution** ✅
- **Schedule**: Runs every working day (Monday-Friday) at 9 AM UTC
- **Function**: `distributeDailyROI`
- **Logic**:
  - Calculates daily ROI based on income rules
  - 2% for packages ≥ ₹50,000 (with security)
  - 1.5% for packages < ₹50,000 (without security)
  - Stops after 60 working days
  - Updates user wallet balance
  - Creates transaction records
  - Tracks working days processed

### 2. **Referral Commission Distribution** ✅
- **Trigger**: Automatically triggers when package status changes from `pending` to `active`
- **Function**: `distributeReferralCommission`
- **Logic**:
  - Calculates 5% direct referral commission (configurable)
  - Distributes to referrer's wallet
  - Updates referrer's direct referrals count
  - Triggers level income distribution

### 3. **Level Income Distribution** ✅
- **Trigger**: Automatically triggered after referral commission
- **Function**: `distributeLevelIncome` (internal)
- **Logic**:
  - Calculates level income for 1-25 levels
  - Uses configurable level percentages:
    - Levels 1-5: 5%
    - Levels 6-10: 4%
    - Levels 11-15: 3%
    - Levels 16-20: 2%
    - Levels 21-25: 1%
  - Distributes to all upline members
  - Updates wallet balances

### 4. **Weekly Payout Processing** ✅
- **Schedule**: Runs every Monday at 9 AM UTC
- **Function**: `processWeeklyPayouts`
- **Logic**:
  - Processes all users with wallet balance > 0
  - Applies admin charges (10% configurable)
  - Creates payout records (status: pending)
  - Resets wallet balance
  - Creates transaction records
  - Admin processes payouts manually

## 📁 Files Created

### Cloud Functions
- `functions/package.json` - Functions dependencies
- `functions/index.js` - Main functions code
- `functions/.eslintrc.js` - ESLint configuration
- `functions/.gitignore` - Git ignore file

### Updated Files
- `firebase.json` - Added functions configuration
- `firestore.rules` - Added payouts collection rules

## 🚀 Deployment Steps

### 1. Install Functions Dependencies
```bash
cd functions
npm install
cd ..
```

### 2. Deploy Functions
```bash
firebase deploy --only functions --project mlmplan
```

### 3. Verify Deployment
- Go to Firebase Console → Functions
- Check that all functions are deployed
- Verify scheduled triggers are active

## 🔧 Configuration

### Income Rules (Admin Panel)
- Go to `/admin/income-rules`
- Configure daily percentages
- Set max working days
- Set minimum package amount for security

### Marketing Config (Admin Panel)
- Go to `/admin/marketing-plan`
- Configure direct referral percentage
- Configure level percentages (1-25 levels)

### Terms Config (Admin Panel)
- Go to `/admin/terms`
- Configure admin charges percentage
- Set payout schedule

## 📊 Data Flow

### Daily ROI Flow
1. Scheduled function runs at 9 AM UTC (Mon-Fri)
2. Fetches all active packages
3. Calculates daily ROI for each package
4. Updates user wallet balance
5. Creates transaction record
6. Updates package working days count

### Referral Commission Flow
1. User activates package (payment successful)
2. Package status changes to `active`
3. Function triggers automatically
4. Finds user's referrer
5. Calculates 5% commission
6. Updates referrer's wallet
7. Updates referrer's direct referrals count
8. Triggers level income distribution

### Level Income Flow
1. Triggered after referral commission
2. Gets upline chain (up to 25 levels)
3. For each level, calculates income based on percentage
4. Updates each upline member's wallet
5. Creates transaction records for each level

### Weekly Payout Flow
1. Scheduled function runs every Monday at 9 AM UTC
2. Finds all users with wallet balance > 0
3. Calculates admin charges (10%)
4. Creates payout record (status: pending)
5. Resets wallet balance
6. Creates transaction record
7. Admin processes payouts manually

## 📝 Firestore Collections

### New Collections
- `payouts` - Payout requests and history
  ```javascript
  {
    userId: string,
    walletBalanceBefore: number,
    payoutAmount: number,
    adminCharges: number,
    adminChargesPercent: number,
    status: 'pending' | 'processed' | 'rejected',
    requestedAt: timestamp,
    processedAt: timestamp,
    week: timestamp
  }
  ```

### Updated Collections
- `userPackages` - Added fields:
  - `workingDaysProcessed`: number
  - `lastROIDistribution`: timestamp
  - `totalROIEarned`: number

- `users` - Added fields:
  - `walletBalance`: number
  - `totalIncome`: number
  - `directReferrals`: number
  - `pendingPayout`: number
  - `lastIncomeUpdate`: timestamp
  - `lastPayoutRequest`: timestamp

- `transactions` - New transaction types:
  - `daily_roi`
  - `direct_referral`
  - `level_income`
  - `payout_request`

## 🧪 Testing

### Test Daily ROI
1. Create an active package
2. Wait for scheduled function or trigger manually
3. Check user wallet balance updated
4. Check transaction created
5. Check package working days incremented

### Test Referral Commission
1. User A refers User B
2. User B activates a package
3. Check User A's wallet balance updated
4. Check User A's direct referrals count incremented
5. Check transaction created

### Test Level Income
1. Create a multi-level referral chain
2. Bottom user activates package
3. Check all upline members' wallets updated
4. Check transactions created for each level

### Test Weekly Payouts
1. User has wallet balance > 0
2. Wait for Monday or trigger manually
3. Check payout record created
4. Check wallet balance reset
5. Check transaction created

## ⚠️ Important Notes

1. **Scheduled Functions**: Require Firebase Blaze plan (pay-as-you-go)
2. **Time Zone**: All schedules use UTC timezone
3. **Working Days**: Only Monday-Friday are processed
4. **Admin Charges**: Applied during payout, not during income distribution
5. **Payout Processing**: Manual by admin (for security)
6. **Error Handling**: All functions have try-catch blocks
7. **Logging**: All functions log to Firebase Functions logs

## 🔒 Security

- All income calculations are server-side only
- Functions use Firebase Admin SDK (full access)
- Firestore rules protect user data
- Payouts require admin approval
- All transactions are logged

## 📞 Support

If you encounter issues:
1. Check Firebase Functions logs
2. Verify functions are deployed
3. Check Firestore rules
4. Verify income rules and marketing config are set
5. Check user data structure

## 🎯 Next Steps

1. ✅ Deploy functions
2. ✅ Test with sample data
3. ✅ Monitor first few distributions
4. ✅ Create admin payout processing page (optional)
5. ✅ Set up alerts for errors

