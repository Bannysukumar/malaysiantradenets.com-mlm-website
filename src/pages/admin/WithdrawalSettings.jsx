import { useFirestore } from '../../hooks/useFirestore'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Settings, DollarSign, Calendar, Shield } from 'lucide-react'

export default function AdminWithdrawalSettings() {
  const { data: withdrawalConfig, loading } = useFirestore(doc(db, 'adminConfig', 'withdrawals'))
  const { register, handleSubmit } = useForm({
    defaultValues: withdrawalConfig || {
      minWithdrawal: 400,
      maxWithdrawal: 100000,
      feePercent: 10,
      feeFlat: 0,
      usePercentFee: true,
      allowedMethods: ['bank', 'upi'],
      allowedDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      cutoffDay: 'friday',
      cutoffTime: '17:00',
      requireKyc: false,
      requireBankVerified: true,
      requireDirectsCount: 0,
      maxWithdrawalsPerDay: 3,
      maxWithdrawalsPerWeek: 5,
      maxWithdrawalsPerMonth: 10,
      cooldownHours: 24,
    },
  })

  const onSubmit = async (data) => {
    try {
      await setDoc(doc(db, 'adminConfig', 'withdrawals'), {
        minWithdrawal: parseFloat(data.minWithdrawal),
        maxWithdrawal: parseFloat(data.maxWithdrawal),
        feePercent: parseFloat(data.feePercent),
        feeFlat: parseFloat(data.feeFlat),
        usePercentFee: data.usePercentFee === true || data.usePercentFee === 'true',
        allowedMethods: Array.isArray(data.allowedMethods) ? data.allowedMethods : [data.allowedMethods].filter(Boolean),
        allowedDays: Array.isArray(data.allowedDays) ? data.allowedDays : [data.allowedDays].filter(Boolean),
        cutoffDay: data.cutoffDay,
        cutoffTime: data.cutoffTime,
        requireKyc: data.requireKyc === true || data.requireKyc === 'true',
        requireBankVerified: data.requireBankVerified === true || data.requireBankVerified === 'true',
        requireDirectsCount: parseInt(data.requireDirectsCount) || 0,
        maxWithdrawalsPerDay: parseInt(data.maxWithdrawalsPerDay) || 0,
        maxWithdrawalsPerWeek: parseInt(data.maxWithdrawalsPerWeek) || 0,
        maxWithdrawalsPerMonth: parseInt(data.maxWithdrawalsPerMonth) || 0,
        cooldownHours: parseInt(data.cooldownHours) || 0,
      }, { merge: true })
      toast.success('Withdrawal settings updated successfully')
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
        Withdrawal Settings
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <DollarSign className="text-primary" size={24} />
            Amount Limits
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Minimum Withdrawal</label>
              <input
                type="number"
                step="0.01"
                {...register('minWithdrawal', { required: true })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Maximum Withdrawal</label>
              <input
                type="number"
                step="0.01"
                {...register('maxWithdrawal', { required: true })}
                className="input-field"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <DollarSign className="text-primary" size={24} />
            Fees
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('usePercentFee')}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Use Percentage Fee</label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Fee Percentage (%)</label>
                <input
                  type="number"
                  step="0.1"
                  {...register('feePercent')}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Flat Fee (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  {...register('feeFlat')}
                  className="input-field"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Calendar className="text-primary" size={24} />
            Schedule & Limits
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Allowed Withdrawal Days</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                  <label key={day} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      value={day}
                      {...register('allowedDays')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm capitalize">{day}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Cutoff Day</label>
                <select {...register('cutoffDay')} className="input-field">
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Cutoff Time</label>
                <input
                  type="time"
                  {...register('cutoffTime')}
                  className="input-field"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Max Per Day</label>
                <input
                  type="number"
                  {...register('maxWithdrawalsPerDay')}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Max Per Week</label>
                <input
                  type="number"
                  {...register('maxWithdrawalsPerWeek')}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Max Per Month</label>
                <input
                  type="number"
                  {...register('maxWithdrawalsPerMonth')}
                  className="input-field"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Cooldown (Hours)</label>
              <input
                type="number"
                {...register('cooldownHours')}
                className="input-field"
                placeholder="Hours between withdrawals"
              />
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
                {...register('requireKyc')}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Require KYC Verification</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('requireBankVerified')}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Require Bank Details Verified</label>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Require Minimum Direct Referrals</label>
              <input
                type="number"
                {...register('requireDirectsCount')}
                className="input-field"
                placeholder="0 = no requirement"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">Allowed Methods</h2>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                value="bank"
                {...register('allowedMethods')}
                className="w-4 h-4"
              />
              <span className="text-sm">Bank Transfer</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                value="upi"
                {...register('allowedMethods')}
                className="w-4 h-4"
              />
              <span className="text-sm">UPI</span>
            </label>
          </div>
        </div>

        <button type="submit" className="btn-primary">
          Save Withdrawal Settings
        </button>
      </form>
    </div>
  )
}

