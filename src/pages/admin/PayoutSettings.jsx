import { useFirestore } from '../../hooks/useFirestore'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { DollarSign, Calendar, Clock, AlertCircle, CheckCircle, Settings } from 'lucide-react'
import { useEffect } from 'react'

export default function AdminPayoutSettings() {
  const { data: payoutConfig, loading } = useFirestore(doc(db, 'adminConfig', 'payouts'))
  
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: payoutConfig || {
      enableWeeklyPayouts: true,
      roiCalculationPeriod: 'WEEKLY_MON_FRI', // Monday to Friday
      cutoffDay: 'FRIDAY',
      payoutReleaseDay: 'MONDAY',
      adminChargesPercent: 10.0,
      adminChargesApplyTo: ['daily_roi', 'REFERRAL_DIRECT', 'REFERRAL_LEVEL', 'level_income', 'bonus'],
      enforceCutoff: true,
      cutoffTime: '23:59', // 11:59 PM
      payoutTime: '09:00', // 9:00 AM
      timezone: 'UTC',
      autoProcessPayouts: false, // Manual processing by admin
      minPayoutAmount: 0, // 0 = no minimum
      maxPayoutAmount: 0, // 0 = no maximum
      notes: 'ROI is calculated weekly (Monday to Friday). Cutoff for all incomes: Every Friday. Payout release: Every Monday. Admin charges: 10% on all ROI & incentives.'
    }
  })

  useEffect(() => {
    if (payoutConfig) {
      reset(payoutConfig)
    }
  }, [payoutConfig, reset])

  const onSubmit = async (data) => {
    try {
      // Process admin charges apply to array
      const adminChargesApplyTo = Array.isArray(data.adminChargesApplyTo) 
        ? data.adminChargesApplyTo 
        : (data.adminChargesApplyTo ? [data.adminChargesApplyTo] : []);

      await setDoc(doc(db, 'adminConfig', 'payouts'), {
        enableWeeklyPayouts: data.enableWeeklyPayouts === true || data.enableWeeklyPayouts === 'true',
        roiCalculationPeriod: data.roiCalculationPeriod || 'WEEKLY_MON_FRI',
        cutoffDay: data.cutoffDay || 'FRIDAY',
        payoutReleaseDay: data.payoutReleaseDay || 'MONDAY',
        adminChargesPercent: parseFloat(data.adminChargesPercent) || 10.0,
        adminChargesApplyTo: adminChargesApplyTo,
        enforceCutoff: data.enforceCutoff === true || data.enforceCutoff === 'true',
        cutoffTime: data.cutoffTime || '23:59',
        payoutTime: data.payoutTime || '09:00',
        timezone: data.timezone || 'UTC',
        autoProcessPayouts: data.autoProcessPayouts === true || data.autoProcessPayouts === 'true',
        minPayoutAmount: parseFloat(data.minPayoutAmount) || 0,
        maxPayoutAmount: parseFloat(data.maxPayoutAmount) || 0,
        notes: data.notes || '',
        updatedAt: new Date()
      }, { merge: true })
      
      toast.success('Payout settings updated successfully')
    } catch (error) {
      console.error('Payout settings update error:', error)
      toast.error('Error updating payout settings: ' + (error.message || 'Unknown error'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const enableWeeklyPayouts = watch('enableWeeklyPayouts')
  const enforceCutoff = watch('enforceCutoff')

  const incomeTypes = [
    { value: 'daily_roi', label: 'Daily ROI' },
    { value: 'REFERRAL_DIRECT', label: 'Direct Referral Income' },
    { value: 'REFERRAL_LEVEL', label: 'Level Referral Income' },
    { value: 'level_income', label: 'Level Income' },
    { value: 'bonus', label: 'Bonus' },
    { value: 'achievement_level_income', label: 'Achievement Level Income' }
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <DollarSign className="text-primary" size={32} />
        Payout Settings
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* General Settings */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Settings className="text-primary" size={24} />
            General Settings
          </h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('enableWeeklyPayouts')}
                className="w-5 h-5"
              />
              <div>
                <div className="font-semibold">Enable Weekly Payouts</div>
                <div className="text-sm text-gray-400">
                  Enable automatic weekly payout processing
                </div>
              </div>
            </label>

            <div>
              <label className="block text-sm font-medium mb-2">ROI Calculation Period</label>
              <select
                {...register('roiCalculationPeriod')}
                className="input-field"
              >
                <option value="WEEKLY_MON_FRI">Weekly (Monday to Friday)</option>
                <option value="DAILY">Daily</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                ROI is calculated weekly (Monday to Friday) for Investor program
              </p>
            </div>
          </div>
        </div>

        {/* Cutoff & Release Schedule */}
        {enableWeeklyPayouts && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Calendar className="text-primary" size={24} />
              Cutoff & Release Schedule
            </h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('enforceCutoff')}
                  className="w-5 h-5"
                />
                <div>
                  <div className="font-semibold">Enforce Cutoff</div>
                  <div className="text-sm text-gray-400">
                    Only process payouts after cutoff day has passed
                  </div>
                </div>
              </label>

              {enforceCutoff && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Cutoff Day</label>
                    <select
                      {...register('cutoffDay')}
                      className="input-field"
                    >
                      <option value="FRIDAY">Friday</option>
                      <option value="SATURDAY">Saturday</option>
                      <option value="SUNDAY">Sunday</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      All incomes are cut off on this day
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Cutoff Time</label>
                    <input
                      type="time"
                      {...register('cutoffTime')}
                      className="input-field"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Time when cutoff takes effect (default: 23:59 / 11:59 PM)
                    </p>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Payout Release Day</label>
                <select
                  {...register('payoutReleaseDay')}
                  className="input-field"
                >
                  <option value="MONDAY">Monday</option>
                  <option value="TUESDAY">Tuesday</option>
                  <option value="WEDNESDAY">Wednesday</option>
                  <option value="THURSDAY">Thursday</option>
                  <option value="FRIDAY">Friday</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Payouts are released every week on this day
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Payout Time</label>
                <input
                  type="time"
                  {...register('payoutTime')}
                  className="input-field"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Time when payout processing starts (default: 09:00 / 9:00 AM)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Timezone</label>
                <select
                  {...register('timezone')}
                  className="input-field"
                >
                  <option value="UTC">UTC</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Timezone for cutoff and payout times
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Admin Charges */}
        {enableWeeklyPayouts && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <DollarSign className="text-primary" size={24} />
              Admin Charges Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Admin Charges Percentage (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  {...register('adminChargesPercent', { 
                    required: 'Admin charges percent is required',
                    min: { value: 0, message: 'Must be 0 or greater' },
                    max: { value: 100, message: 'Cannot exceed 100%' }
                  })}
                  className="input-field"
                />
                {errors.adminChargesPercent && (
                  <p className="text-red-500 text-sm mt-1">{errors.adminChargesPercent.message}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Admin charges applied to all ROI & incentives (default: 10%)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Apply Admin Charges To
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  Select which income types should have admin charges applied:
                </p>
                <div className="space-y-2">
                  {incomeTypes.map(type => (
                    <label key={type.value} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        value={type.value}
                        {...register('adminChargesApplyTo')}
                        className="w-4 h-4"
                        defaultChecked={payoutConfig?.adminChargesApplyTo?.includes(type.value) ?? 
                          ['daily_roi', 'REFERRAL_DIRECT', 'REFERRAL_LEVEL', 'level_income', 'bonus'].includes(type.value)}
                      />
                      <span className="text-sm">{type.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Admin charges are deducted from wallet balance before payout
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Payout Limits */}
        {enableWeeklyPayouts && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <AlertCircle className="text-primary" size={24} />
              Payout Limits
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Minimum Payout Amount (INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('minPayoutAmount')}
                  className="input-field"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Minimum wallet balance required for payout (0 = no minimum)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Maximum Payout Amount (INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('maxPayoutAmount')}
                  className="input-field"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Maximum payout amount per week (0 = no maximum)
                </p>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('autoProcessPayouts')}
                  className="w-5 h-5"
                />
                <div>
                  <div className="font-semibold">Auto-Process Payouts</div>
                  <div className="text-sm text-gray-400">
                    Automatically process payouts (if disabled, admin must manually process)
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Information Box */}
        <div className="card bg-blue-500/20 border border-blue-500">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <CheckCircle className="text-blue-500" size={24} />
            Payout Schedule Information
          </h2>
          <div className="space-y-2 text-sm text-blue-300">
            <p><strong>Current Schedule:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>ROI is calculated weekly (Monday to Friday)</li>
              <li>Cutoff for all incomes: Every {watch('cutoffDay') || 'Friday'}</li>
              <li>Payout release: Every {watch('payoutReleaseDay') || 'Monday'}</li>
              <li>Admin charges: {watch('adminChargesPercent') || 10}% on all ROI & incentives</li>
              <li>Transactions supported via INR / USDT</li>
            </ul>
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="text-primary" size={24} />
            Notes
          </h2>
          <div>
            <label className="block text-sm font-medium mb-2">Additional Notes</label>
            <textarea
              {...register('notes')}
              className="input-field min-h-[100px]"
              placeholder="Additional notes about payout schedule..."
            />
          </div>
        </div>

        <button type="submit" className="btn-primary">
          Save Payout Settings
        </button>
      </form>
    </div>
  )
}

