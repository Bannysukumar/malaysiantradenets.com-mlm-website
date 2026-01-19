import { useFirestore } from '../../hooks/useFirestore'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Settings, RefreshCw, DollarSign, Shield, AlertCircle } from 'lucide-react'

export default function AdminRenewalSettings() {
  const { data: renewalConfig, loading } = useFirestore(doc(db, 'adminConfig', 'renewals'))
  const { register, handleSubmit, watch } = useForm({
    defaultValues: renewalConfig || {
      enableIdRenewalRule: false,
      defaultCapMultiplier: 3.0,
      capAction: 'STOP_EARNINGS',
      eligibleIncomeTypes: ['daily_roi', 'direct_referral', 'level_income', 'bonus'],
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
    },
  })

  const capAction = watch('capAction')
  const enableRule = watch('enableIdRenewalRule')

  const onSubmit = async (data) => {
    try {
      await setDoc(doc(db, 'adminConfig', 'renewals'), {
        enableIdRenewalRule: data.enableIdRenewalRule === true || data.enableIdRenewalRule === 'true',
        defaultCapMultiplier: parseFloat(data.defaultCapMultiplier) || 3.0,
        capAction: data.capAction,
        eligibleIncomeTypes: Array.isArray(data.eligibleIncomeTypes) 
          ? data.eligibleIncomeTypes 
          : (data.eligibleIncomeTypes ? [data.eligibleIncomeTypes] : []),
        graceLimitInr: parseFloat(data.graceLimitInr) || 0,
        autoMarkCapReached: data.autoMarkCapReached === true || data.autoMarkCapReached === 'true',
        renewalRequiredMessage: data.renewalRequiredMessage || 'You reached 3× cap. Renew ID to continue earning.',
        allowRenewSamePlan: data.allowRenewSamePlan === true || data.allowRenewSamePlan === 'true',
        allowRenewUpgrade: data.allowRenewUpgrade === true || data.allowRenewUpgrade === 'true',
        renewalOptions: {
          adminCanRenew: data.renewalOptions?.adminCanRenew === true || data['renewalOptions.adminCanRenew'] === true,
          userCanRequestRenewal: data.renewalOptions?.userCanRequestRenewal === true || data['renewalOptions.userCanRequestRenewal'] === true,
          sponsorCanRenew: data.renewalOptions?.sponsorCanRenew === true || data['renewalOptions.sponsorCanRenew'] === true,
          walletCanPayRenewal: data.renewalOptions?.walletCanPayRenewal === true || data['renewalOptions.walletCanPayRenewal'] === true,
          paymentGatewayRenewal: data.renewalOptions?.paymentGatewayRenewal === true || data['renewalOptions.paymentGatewayRenewal'] === true
        },
        renewalFeePercent: parseFloat(data.renewalFeePercent) || 0,
        requireKycForRenewal: data.requireKycForRenewal === true || data.requireKycForRenewal === 'true',
        requireBankVerifiedForWithdrawalsAfterRenewal: data.requireBankVerifiedForWithdrawalsAfterRenewal === true || data.requireBankVerifiedForWithdrawalsAfterRenewal === 'true'
      }, { merge: true })
      toast.success('Renewal settings updated successfully')
    } catch (error) {
      console.error('Renewal settings update error:', error)
      toast.error('Error updating settings: ' + (error.message || 'Unknown error'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const incomeTypes = [
    { value: 'daily_roi', label: 'Daily ROI' },
    { value: 'REFERRAL_DIRECT', label: 'Direct Referral Income' },
    { value: 'direct_referral', label: 'Direct Referral (Legacy)' },
    { value: 'level_income', label: 'Level Income' },
    { value: 'bonus', label: 'Bonus' },
    { value: 'admin_adjustment', label: 'Admin Adjustment' }
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <RefreshCw className="text-primary" size={32} />
        ID Renewal Settings
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Settings className="text-primary" size={24} />
            General Settings
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('enableIdRenewalRule')}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Enable ID Renewal Rule</label>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Default Cap Multiplier</label>
              <input
                type="number"
                step="0.1"
                {...register('defaultCapMultiplier')}
                className="input-field"
                placeholder="3.0"
              />
              <p className="text-xs text-gray-400 mt-1">Earnings cap = Base Amount × Multiplier (default: 3.0)</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Cap Action</label>
              <select {...register('capAction')} className="input-field">
                <option value="STOP_EARNINGS">Stop Earnings (Recommended)</option>
                <option value="BLOCK_WITHDRAWALS">Block Withdrawals Only</option>
                <option value="STOP_BOTH">Stop Both Earnings & Withdrawals</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {capAction === 'STOP_EARNINGS' && 'New incomes will be rejected when cap is reached'}
                {capAction === 'BLOCK_WITHDRAWALS' && 'Users can still earn but cannot withdraw'}
                {capAction === 'STOP_BOTH' && 'Both earnings and withdrawals will be blocked'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Grace Limit (INR)</label>
              <input
                type="number"
                step="0.01"
                {...register('graceLimitInr')}
                className="input-field"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">Allow small overrun beyond cap (optional)</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('autoMarkCapReached')}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Auto-mark cap as reached when threshold crossed</label>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <DollarSign className="text-primary" size={24} />
            Eligible Income Types
          </h2>
          <div className="space-y-2">
            <p className="text-sm text-gray-400 mb-2">Select which income types count toward the 3× cap:</p>
            {incomeTypes.map(type => (
              <label key={type.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  value={type.value}
                  {...register('eligibleIncomeTypes')}
                  className="w-4 h-4"
                />
                <span className="text-sm">{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <RefreshCw className="text-primary" size={24} />
            Renewal Options
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Renewal Methods Allowed</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    {...register('renewalOptions.adminCanRenew')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Admin Can Renew (Complimentary)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    {...register('renewalOptions.userCanRequestRenewal')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">User Can Request Renewal</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    {...register('renewalOptions.sponsorCanRenew')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Sponsor Can Renew (Wallet)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    {...register('renewalOptions.walletCanPayRenewal')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">User Can Pay from Wallet</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    {...register('renewalOptions.paymentGatewayRenewal')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Payment Gateway (Razorpay)</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Renewal Fee Percentage</label>
              <input
                type="number"
                step="0.1"
                {...register('renewalFeePercent')}
                className="input-field"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1">Additional fee on renewal amount (0 = no fee)</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('allowRenewSamePlan')}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Allow Renewal with Same Plan</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('allowRenewUpgrade')}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Allow Renewal with Upgrade</label>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Shield className="text-primary" size={24} />
            Requirements
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('requireKycForRenewal')}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Require KYC for Renewal</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('requireBankVerifiedForWithdrawalsAfterRenewal')}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Require Bank Verified for Withdrawals After Renewal</label>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <AlertCircle className="text-primary" size={24} />
            Messages
          </h2>
          <div>
            <label className="block text-sm font-medium mb-2">Renewal Required Message</label>
            <textarea
              {...register('renewalRequiredMessage')}
              className="input-field min-h-[100px]"
              placeholder="You reached 3× cap. Renew ID to continue earning."
            />
            <p className="text-xs text-gray-400 mt-1">Message shown to users when cap is reached</p>
          </div>
        </div>

        <button type="submit" className="btn-primary">
          Save Renewal Settings
        </button>
      </form>
    </div>
  )
}

