# 📋 Manual Configuration Guide - Program Types System

## Step-by-Step Guide to Configure All Settings

Follow these steps in order to configure your entire system:

---

## **STEP 1: Configure Income Rules (ROI Calculation)**

### **Location:** `/admin/income-rules`

1. **Login to Admin Panel**
   - Go to your admin login page
   - Login with admin credentials

2. **Navigate to Income Rules**
   - Click on **"Income Rules"** in the sidebar
   - Or go directly to: `/admin/income-rules`

3. **Configure "With Security" Settings:**
   - **Minimum Package (INR):** `50000`
   - **Daily Percentage:** `0.5`
   - **Maximum Working Days:** `421`
   - **Note:** `With Security: 0.5% daily, up to 421 working days (Monday to Friday)`

4. **Configure "Without Security" Settings:**
   - **Daily Percentage:** `1.0`
   - **Maximum Working Days:** `221`
   - **Note:** `Without Security: 1% daily, up to 221 working days (Monday to Friday)`

5. **Click "Save Changes"**

---

## **STEP 2: Update Package Prices**

### **Location:** `/admin/packages`

1. **Navigate to Packages**
   - Click on **"Packages"** in the sidebar
   - Or go directly to: `/admin/packages`

2. **For Each Package, Click "Edit" and Update:**

   **Bronze:**
   - Name: `Bronze`
   - USD Price: `111`
   - INR Price: `10000`
   - Click **"Update Package"**

   **Silver:**
   - Name: `Silver`
   - USD Price: `278`
   - INR Price: `25000`
   - Click **"Update Package"**

   **Gold:**
   - Name: `Gold`
   - USD Price: `555`
   - INR Price: `50000`
   - Click **"Update Package"**

   **Diamond:**
   - Name: `Diamond`
   - USD Price: `1111`
   - INR Price: `100000`
   - Click **"Update Package"**

   **Platinum:**
   - Name: `Platinum`
   - USD Price: `2222`
   - INR Price: `200000`
   - Click **"Update Package"**

   **Platinum+:**
   - Name: `Platinum+`
   - USD Price: `3333`
   - INR Price: `300000`
   - Click **"Update Package"**

   **Crown:**
   - Name: `Crown`
   - USD Price: `5555`
   - INR Price: `500000`
   - Click **"Update Package"**

   **Double Crown:**
   - Name: `Double Crown`
   - USD Price: `11111`
   - INR Price: `1000000`
   - Click **"Update Package"**

3. **If Package Doesn't Exist, Click "Add Package" and Create It**

---

## **STEP 3: Configure Referral Income Settings**

### **Location:** `/admin/referral-income-settings`

1. **Navigate to Referral Income Settings**
   - Click on **"Referral Income Settings"** in the sidebar
   - Or go directly to: `/admin/referral-income-settings`

2. **Global Settings:**
   - ✅ **Enable Referral Income Globally** - Check this box
   - ✅ **Enable Investor Referral Income** - Check this box
   - ⚠️ **Leader Referral Income** - Should be LOCKED OFF (cannot enable)

3. **Investor Referral Income Configuration:**
   - **Direct Referral Percentage (%):** `5.0`
   - **Minimum Activation Amount for Referral:** `0` (or set minimum if needed)
   - **Payout Mode:** `Instant to Wallet`
   - ✅ **Referral Income Counts Toward Cap** - Check this box
   - ✅ **When to Credit Referral Income:** Check `When referee activates as Investor`

4. **Multi-Level Income Configuration:**
   - ✅ **Enable Multi-Level Income** - Check this box
   - **Maximum Levels:** `25`

5. **Level Percentages Configuration:**
   Click on **"Add Level Range"** or edit existing ones to match:

   - **Level 1-1:** Percentage `15`
   - **Level 2-2:** Percentage `10`
   - **Level 3-3:** Percentage `8`
   - **Level 4-4:** Percentage `10`
   - **Level 5-5:** Percentage `6`
   - **Level 6-7:** Percentage `5`
   - **Level 8-9:** Percentage `4`
   - **Level 10-10:** Percentage `3`
   - **Level 11-25:** Percentage `2`

   **Important:** Verify that **"Total Level Income"** shows **100%** (green checkmark)
   - If it doesn't show 100%, adjust percentages until it does

6. **Qualification Rules:**
   - ✅ **Enable Qualification Rules** - Check this box
   - **Level 1-3: Minimum Directs:** `5`
   - **Level 4-13: Directs Per Level Ratio:** `2` (1 direct for every 2 levels)
   - **Level 14-25: Directs Per Level Ratio:** `3` (1 direct for every 3 levels)

7. **Anti-Abuse Protection:**
   - ✅ **Block Self-Referral** - Check this box
   - ✅ **Block Circular Referral Chains** - Check this box
   - **Max Referral Income Per Day:** `0` (0 = unlimited)
   - **Max Referral Income Per Referred User:** `0` (0 = unlimited)

8. **Click "Save Referral Income Settings"**

---

## **STEP 4: Configure Payout Settings**

### **Location:** `/admin/payout-settings`

1. **Navigate to Payout Settings**
   - Click on **"Payout Settings"** in the sidebar
   - Or go directly to: `/admin/payout-settings`

2. **General Settings:**
   - ✅ **Enable Weekly Payouts** - Check this box
   - **ROI Calculation Period:** `Weekly (Monday to Friday)`

3. **Cutoff & Release Schedule:**
   - ✅ **Enforce Cutoff** - Check this box
   - **Cutoff Day:** `Friday`
   - **Cutoff Time:** `23:59` (11:59 PM)
   - **Payout Release Day:** `Monday`
   - **Payout Time:** `09:00` (9:00 AM)
   - **Timezone:** `UTC` (or your preferred timezone)

4. **Admin Charges Configuration:**
   - **Admin Charges Percentage (%):** `10.0`
   - **Apply Admin Charges To:** Check all of these:
     - ✅ Daily ROI
     - ✅ Direct Referral Income
     - ✅ Level Referral Income
     - ✅ Level Income
     - ✅ Bonus
     - ✅ Achievement Level Income (optional)

5. **Payout Limits:**
   - **Minimum Payout Amount (INR):** `0` (0 = no minimum)
   - **Maximum Payout Amount (INR):** `0` (0 = no maximum)
   - ⚠️ **Auto-Process Payouts:** Leave unchecked (manual processing recommended)

6. **Notes (Optional):**
   ```
   ROI is calculated weekly (Monday to Friday). 
   Cutoff for all incomes: Every Friday. 
   Payout release: Every Monday. 
   Admin charges: 10% on all ROI & incentives.
   Transactions supported via INR / USDT
   ```

7. **Click "Save Payout Settings"**

---

## **STEP 5: Configure Program Settings**

### **Location:** `/admin/program-settings`

1. **Navigate to Program Settings**
   - Click on **"Program Settings"** in the sidebar
   - Or go directly to: `/admin/program-settings`

2. **Enable Programs:**
   - ✅ **Enable Investor Program** - Check this box
   - ✅ **Enable Leader Program** - Check this box

3. **Investor Program Configuration:**
   - **Cap Multiplier:** `2.0` (for 2× cap)
   - This means: Earnings cap = Activated Amount × 2

4. **Leader Program Configuration:**
   - **Cap Multiplier:** `3.0` (for 3× cap)
   - **Leader Base Amount (INR):** Set your desired base amount (e.g., `1000`)
   - This means: Earnings cap = Base Amount × 3
   - ⚠️ **Note:** ROI for Leaders is permanently disabled (locked)

5. **Level Income Configuration:**
   - **Level Income Mode:** `Achievement-Based (ENABLED)` - This is locked
   - ✅ **Achievement Level Income Enabled** - Check this box
   - ⚠️ **Referral-Based Level Income:** DISABLED (locked)

6. **Click "Save Program Settings"**

---

## **STEP 6: Configure Renewal Settings**

### **Location:** `/admin/renewal-settings`

1. **Navigate to Renewal Settings**
   - Click on **"Renewal Settings"** in the sidebar
   - Or go directly to: `/admin/renewal-settings`

2. **General Settings:**
   - ✅ **Enable ID Renewal Rule** - Check this box
   - **Default Cap Multiplier:** `3.0` (for Leaders, Investors use 2.0 from program settings)
   - **Cap Action:** `Stop Earnings` (or `Stop Both` if you want to block withdrawals too)
   - **Grace Limit (INR):** `0` (0 = no grace period)
   - ✅ **Auto-mark cap as reached** - Check this box

3. **Eligible Income Types:**
   Check all income types that count toward cap:
   - ✅ Daily ROI
   - ✅ Direct Referral Income
   - ✅ Direct Referral (Legacy)
   - ✅ Level Income
   - ✅ Bonus
   - ✅ Admin Adjustment (optional)

4. **Renewal Options:**
   - ✅ **Admin Can Renew (Complimentary)** - Check this box
   - ✅ **User Can Request Renewal** - Check this box
   - ⚠️ **Sponsor Can Renew (Wallet)** - Check if you want sponsors to pay
   - ✅ **User Can Pay from Wallet** - Check this box
   - ✅ **Payment Gateway (Razorpay)** - Check this box
   - **Renewal Fee Percentage:** `0` (0 = no additional fee)

5. **Renewal Rules:**
   - ✅ **Allow Renewal with Same Plan** - Check this box
   - ✅ **Allow Renewal with Upgrade** - Check this box

6. **Requirements:**
   - ⚠️ **Require KYC for Renewal** - Check if needed
   - ⚠️ **Require Bank Verified for Withdrawals After Renewal** - Check if needed

7. **Messages:**
   - **Renewal Required Message:** 
     ```
     You reached your earning cap. Renew ID to continue earning.
     ```

8. **Click "Save Renewal Settings"**

---

## **STEP 7: Verify All Settings**

### **Verification Checklist:**

1. ✅ **Income Rules:**
   - With Security: 0.5% daily, 421 days
   - Without Security: 1.0% daily, 221 days

2. ✅ **Packages:**
   - All 8 packages created/updated with correct prices
   - Bronze: ₹10,000
   - Silver: ₹25,000
   - Gold: ₹50,000
   - Diamond: ₹1,00,000
   - Platinum: ₹2,00,000
   - Platinum+: ₹3,00,000
   - Crown: ₹5,00,000
   - Double Crown: ₹10,00,000

3. ✅ **Referral Income:**
   - Direct Referral: 5%
   - Level percentages total: 100%
   - Qualification rules enabled
   - Level 1-3: 5 directs
   - Level 4-13: 1 direct per 2 levels
   - Level 14-25: 1 direct per 3 levels

4. ✅ **Payout Settings:**
   - Weekly payouts enabled
   - Cutoff: Friday
   - Release: Monday
   - Admin charges: 10%

5. ✅ **Program Settings:**
   - Investor: 2× cap
   - Leader: 3× cap
   - Leader base amount set

6. ✅ **Renewal Settings:**
   - ID renewal enabled
   - Renewal methods configured

---

## **QUICK REFERENCE: Admin Panel URLs**

- Income Rules: `/admin/income-rules`
- Packages: `/admin/packages`
- Referral Income Settings: `/admin/referral-income-settings`
- Payout Settings: `/admin/payout-settings`
- Program Settings: `/admin/program-settings`
- Renewal Settings: `/admin/renewal-settings`

---

## **IMPORTANT NOTES**

### **Investor Program:**
- ✅ Paid activation required
- ✅ Status: ACTIVE_INVESTOR
- ✅ Daily ROI (Mon-Fri): 0.5% or 1% based on package
- ✅ Direct Referral: 5%
- ✅ Level Income: 1-25 levels with qualification rules
- ✅ Cap: 2× activation amount

### **Leader Program:**
- ✅ Zero activation cost (FREE)
- ✅ Status: ACTIVE_LEADER
- ❌ NO ROI
- ❌ NO Referral Income
- ✅ Only Achievement-based level income
- ✅ Cap: 3× base amount

### **Payout Schedule:**
- ROI calculated: Monday to Friday
- Cutoff: Every Friday at 23:59
- Release: Every Monday at 09:00
- Admin charges: 10% on all ROI & incentives

---

## **TROUBLESHOOTING**

### **Issue: Level percentages don't total 100%**
**Solution:** Adjust percentages until total shows 100% (green checkmark)

### **Issue: Packages not showing correct prices**
**Solution:** Make sure you clicked "Update Package" after editing each package

### **Issue: Payout not processing**
**Solution:** 
- Check if "Enable Weekly Payouts" is checked
- Verify cutoff day (Friday) has passed
- Check if today is Monday (release day)

### **Issue: Referral income not distributing**
**Solution:**
- Check "Enable Referral Income Globally" is checked
- Check "Enable Investor Referral Income" is checked
- Verify user is ACTIVE_INVESTOR
- Check qualification rules are met

---

## **✅ CONFIGURATION COMPLETE!**

Once all steps are completed, your system is fully configured and ready to use!

**Next Steps:**
1. Test Investor activation
2. Test referral income distribution
3. Test payout processing
4. Monitor system for any issues

---

## **SUPPORT**

If you encounter any issues during configuration:
1. Check the verification checklist above
2. Review error messages in browser console
3. Check Firebase Functions logs
4. Verify all settings are saved correctly

