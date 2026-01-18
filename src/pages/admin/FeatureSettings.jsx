import { useFirestore } from '../../hooks/useFirestore'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Settings, DollarSign, Users, Shield, ToggleLeft, ToggleRight } from 'lucide-react'

export default function AdminFeatureSettings() {
  const { data: featureConfig, loading } = useFirestore(doc(db, 'adminConfig', 'features'))
  const { register, handleSubmit, watch } = useForm({
    defaultValues: featureConfig || {
      enableUserTransfers: false,
      enableSponsorActivation: false,
      enableTransferToUnverifiedUsers: false,
      enableTransferFee: false,
      transferFeeType: 'percent',
      transferFeeValue: 0,
      transferMinAmount: 100,
      transferMaxAmount: 10000,
      transferDailyLimit: 5,
      transferCooldownMinutes: 30,
      requireKycForTransfers: false,
      requireEmailVerifiedForTransfers: true,
      sponsorActivationAllowedPlans: [],
      sponsorActivationMinBalanceRule: 0,
      sponsorActivationDailyLimit: 3,
      sponsorActivationDailyAmountLimit: 50000,
    },
  })

  const enableUserTransfers = watch('enableUserTransfers')
  const enableSponsorActivation = watch('enableSponsorActivation')
  const enableTransferFee = watch('enableTransferFee')

  const onSubmit = async (data) => {
    try {
      await setDoc(doc(db, 'adminConfig', 'features'), {
        enableUserTransfers: data.enableUserTransfers === true || data.enableUserTransfers === 'true',
        enableSponsorActivation: data.enableSponsorActivation === true || data.enableSponsorActivation === 'true',
        enableTransferToUnverifiedUsers: data.enableTransferToUnverifiedUsers === true || data.enableTransferToUnverifiedUsers === 'true',
        enableTransferFee: data.enableTransferFee === true || data.enableTransferFee === 'true',
        transferFeeType: data.transferFeeType || 'percent',
        transferFeeValue: parseFloat(data.transferFeeValue) || 0,
        transferMinAmount: parseFloat(data.transferMinAmount) || 100,
        transferMaxAmount: parseFloat(data.transferMaxAmount) || 10000,
        transferDailyLimit: parseInt(data.transferDailyLimit) || 5,
        transferCooldownMinutes: parseInt(data.transferCooldownMinutes) || 30,
        requireKycForTransfers: data.requireKycForTransfers === true || data.requireKycForTransfers === 'true',
        requireEmailVerifiedForTransfers: data.requireEmailVerifiedForTransfers === true || data.requireEmailVerifiedForTransfers === 'true',
        sponsorActivationAllowedPlans: Array.isArray(data.sponsorActivationAllowedPlans) ? data.sponsorActivationAllowedPlans : [],
        sponsorActivationMinBalanceRule: parseFloat(data.sponsorActivationMinBalanceRule) || 0,
        sponsorActivationDailyLimit: parseInt(data.sponsorActivationDailyLimit) || 3,
        sponsorActivationDailyAmountLimit: parseFloat(data.sponsorActivationDailyAmountLimit) || 50000,
      }, { merge: true })
      toast.success('Feature settings updated successfully')
    } catch (error) {
      console.error('Settings update error:', error)
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

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <Settings className="text-primary" size={32} />
        Feature Settings
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* User Transfers Section */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <DollarSign className="text-primary" size={24} />
            User-to-User Transfers
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Enable User Transfers</label>
                <p className="text-xs text-gray-400">Allow users to transfer funds to other users</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register('enableUserTransfers')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {enableUserTransfers && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Allow Transfer to Unverified Users</label>
                    <p className="text-xs text-gray-400">Allow transfers to users without email/KYC verification</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('enableTransferToUnverifiedUsers')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Require KYC for Transfers</label>
                    <p className="text-xs text-gray-400">Users must be KYC verified to send transfers</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('requireKycForTransfers')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">Require Email Verified for Transfers</label>
                    <p className="text-xs text-gray-400">Users must have verified email to send transfers</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('requireEmailVerifiedForTransfers')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                  <div>
                    <label className="block text-sm font-medium mb-2">Min Transfer Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('transferMinAmount')}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Max Transfer Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('transferMaxAmount')}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Daily Transfer Limit (count)</label>
                    <input
                      type="number"
                      {...register('transferDailyLimit')}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Cooldown (minutes)</label>
                    <input
                      type="number"
                      {...register('transferCooldownMinutes')}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <label className="text-sm font-medium">Enable Transfer Fee</label>
                      <p className="text-xs text-gray-400">Charge a fee on transfers</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        {...register('enableTransferFee')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {enableTransferFee && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Fee Type</label>
                        <select {...register('transferFeeType')} className="input-field">
                          <option value="percent">Percentage (%)</option>
                          <option value="flat">Flat Amount (₹)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Fee Value</label>
                        <input
                          type="number"
                          step="0.01"
                          {...register('transferFeeValue')}
                          className="input-field"
                          placeholder={watch('transferFeeType') === 'percent' ? 'e.g., 2.5' : 'e.g., 10'}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sponsor Activation Section */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Users className="text-primary" size={24} />
            Sponsor Activation
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Enable Sponsor Activation</label>
                <p className="text-xs text-gray-400">Allow users to activate other users' accounts using their balance</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register('enableSponsorActivation')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {enableSponsorActivation && (
              <div className="space-y-4 pt-4 border-t border-gray-700">
                <div>
                  <label className="block text-sm font-medium mb-2">Minimum Balance After Activation (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register('sponsorActivationMinBalanceRule')}
                    className="input-field"
                    placeholder="0 = no requirement"
                  />
                  <p className="text-xs text-gray-400 mt-1">Sponsor must keep this amount in wallet after activation</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Daily Activation Limit (count)</label>
                  <input
                    type="number"
                    {...register('sponsorActivationDailyLimit')}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Daily Activation Amount Limit (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register('sponsorActivationDailyAmountLimit')}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Allowed Plans (comma-separated plan IDs)</label>
                  <input
                    type="text"
                    {...register('sponsorActivationAllowedPlans')}
                    className="input-field"
                    placeholder="plan1,plan2,plan3 or leave empty for all"
                  />
                  <p className="text-xs text-gray-400 mt-1">Leave empty to allow all plans</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <button type="submit" className="btn-primary">
          Save Feature Settings
        </button>
      </form>
    </div>
  )
}

