import { useFirestore } from '../../hooks/useFirestore'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Settings, Clock, Shield, AlertCircle } from 'lucide-react'
import { useEffect } from 'react'

export default function AdminActivationRules() {
  const { data: activationConfig, loading } = useFirestore(doc(db, 'adminConfig', 'activationRules'))
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: activationConfig || {
      activationWindowDays: 7,
      autoBlockEnabled: true,
      blockType: 'soft', // 'soft' or 'hard'
      allowAdminUnblock: true,
      resetWindowOnUnblock: false,
      requireBankDetails: true,
      bankDetailsOverride: false
    }
  })

  useEffect(() => {
    if (activationConfig) {
      reset(activationConfig)
    }
  }, [activationConfig, reset])

  const onSubmit = async (data) => {
    try {
      await setDoc(doc(db, 'adminConfig', 'activationRules'), {
        activationWindowDays: parseInt(data.activationWindowDays) || 7,
        autoBlockEnabled: data.autoBlockEnabled === true || data.autoBlockEnabled === 'true',
        blockType: data.blockType || 'soft',
        allowAdminUnblock: data.allowAdminUnblock === true || data.allowAdminUnblock === 'true',
        resetWindowOnUnblock: data.resetWindowOnUnblock === true || data.resetWindowOnUnblock === 'true',
        requireBankDetails: data.requireBankDetails === true || data.requireBankDetails === 'true',
        bankDetailsOverride: data.bankDetailsOverride === true || data.bankDetailsOverride === 'true',
        updatedAt: new Date()
      }, { merge: true })
      
      toast.success('Activation rules updated successfully')
    } catch (error) {
      console.error('Activation rules update error:', error)
      toast.error('Error updating activation rules: ' + (error.message || 'Unknown error'))
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
        <Clock className="text-primary" size={32} />
        Activation Rules
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Activation Window */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Clock className="text-primary" size={24} />
            Activation Deadline
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Activation Window (Days)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                {...register('activationWindowDays', { 
                  required: 'Activation window is required',
                  min: { value: 1, message: 'Must be at least 1 day' },
                  max: { value: 30, message: 'Cannot exceed 30 days' }
                })}
                className="input-field"
              />
              {errors.activationWindowDays && (
                <p className="text-red-500 text-sm mt-1">{errors.activationWindowDays.message}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Users must activate a plan within this many days after registration, or they will be auto-blocked.
              </p>
            </div>

            <div className="bg-blue-500 bg-opacity-20 border border-blue-500 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-blue-500 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-blue-300">
                  <p className="font-semibold mb-1">How it works:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>User registers → Status: PENDING_ACTIVATION</li>
                    <li>Timer starts from registration date</li>
                    <li>If not activated within window → Status: AUTO_BLOCKED</li>
                    <li>Auto-block runs daily via Cloud Function</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Auto-Block Settings */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Shield className="text-primary" size={24} />
            Auto-Block Configuration
          </h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('autoBlockEnabled')}
                className="w-5 h-5"
              />
              <div>
                <div className="font-semibold">Enable Auto-Block</div>
                <div className="text-sm text-gray-400">
                  Automatically block users who don't activate within the deadline
                </div>
              </div>
            </label>

            <div>
              <label className="block text-sm font-medium mb-2">Block Type</label>
              <select
                {...register('blockType')}
                className="input-field"
              >
                <option value="soft">Soft Block (Can login, limited features)</option>
                <option value="hard">Hard Block (Cannot login)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                <strong>Soft Block:</strong> User can login but sees blocked message and limited access.<br />
                <strong>Hard Block:</strong> User cannot login at all.
              </p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('allowAdminUnblock')}
                className="w-5 h-5"
              />
              <div>
                <div className="font-semibold">Allow Admin Unblock</div>
                <div className="text-sm text-gray-400">
                  Admins can manually unblock users from the user management page
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('resetWindowOnUnblock')}
                className="w-5 h-5"
              />
              <div>
                <div className="font-semibold">Reset Window on Unblock</div>
                <div className="text-sm text-gray-400">
                  When admin unblocks a user, reset their activation deadline timer
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Bank Details Requirements */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Shield className="text-primary" size={24} />
            Bank Details Requirements
          </h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('requireBankDetails')}
                className="w-5 h-5"
              />
              <div>
                <div className="font-semibold">Require Bank Details</div>
                <div className="text-sm text-gray-400">
                  Users must complete bank details before accessing the app
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('bankDetailsOverride')}
                className="w-5 h-5"
              />
              <div>
                <div className="font-semibold">Allow Admin Override</div>
                <div className="text-sm text-gray-400">
                  Admins can bypass bank details requirement for specific users
                </div>
              </div>
            </label>

            <div className="bg-yellow-500 bg-opacity-20 border border-yellow-500 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-yellow-300">
                  <p className="font-semibold mb-1">Bank Details Flow:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>User signs up → Redirected to bank details onboarding</li>
                    <li>Cannot access dashboard until bank details are saved</li>
                    <li>After bank details → Redirected to program selection</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary">
          Save Activation Rules
        </button>
      </form>
    </div>
  )
}

