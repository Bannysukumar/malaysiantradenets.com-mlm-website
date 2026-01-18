# Deploy Cloud Functions - Quick Guide

## ✅ Functions Created

All income distribution functions have been created and are ready to deploy.

## 🚀 Deployment Steps

### 1. Install Dependencies (Already Done)
```bash
cd functions
npm install
cd ..
```

### 2. Deploy Functions
```bash
firebase deploy --only functions --project mlmplan
```

### 3. Deploy Firestore Rules (Already Done)
```bash
firebase deploy --only firestore:rules --project mlmplan
```

## 📋 Functions Deployed

1. **distributeDailyROI**
   - Schedule: Every working day (Mon-Fri) at 9 AM UTC
   - Purpose: Distribute daily ROI to active packages

2. **distributeReferralCommission**
   - Trigger: When package status changes to active
   - Purpose: Distribute referral commission to referrer

3. **processWeeklyPayouts**
   - Schedule: Every Monday at 9 AM UTC
   - Purpose: Process weekly payouts with admin charges

4. **manualDailyROI** (Testing)
   - HTTP Trigger: Manual testing endpoint
   - URL: `https://us-central1-mlmplan.cloudfunctions.net/manualDailyROI`

## ⚠️ Important Notes

1. **Firebase Blaze Plan Required**: Scheduled functions require pay-as-you-go plan
2. **First Deployment**: May take 5-10 minutes
3. **Function URLs**: Will be provided after deployment
4. **Monitoring**: Check Firebase Console → Functions for logs

## 🧪 Testing After Deployment

### Test Daily ROI
1. Create an active package in Firestore
2. Call the manual trigger: `https://us-central1-mlmplan.cloudfunctions.net/manualDailyROI`
3. Check user wallet balance updated
4. Check transaction created

### Test Referral Commission
1. User A refers User B
2. User B activates a package (payment successful)
3. Check User A's wallet balance
4. Check transactions

## 📊 Monitoring

- **Firebase Console** → Functions → Logs
- Check for errors or warnings
- Monitor execution times
- Check function invocations

## 🔧 Troubleshooting

If functions don't deploy:
1. Check Firebase CLI is logged in: `firebase login`
2. Check project is selected: `firebase use mlmplan`
3. Check Node.js version (should be 18+)
4. Check functions/package.json is correct

If functions don't trigger:
1. Check scheduled functions are enabled
2. Check timezone settings (UTC)
3. Check Firestore rules allow function access
4. Check function logs for errors

