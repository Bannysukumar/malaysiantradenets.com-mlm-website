import { useFirestore } from '../../hooks/useFirestore'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Settings, DollarSign, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'
import { useEffect } from 'react'

export default function AdminProgramSettings() {
  const { data: programConfig, loading } = useFirestore(doc(db, 'adminConfig', 'programs'))
  
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: programConfig || {
      enableInvestorProgram: true,
      enableLeaderProgram: true,
      investorCapMultiplier: 2.0,
      leaderCapMultiplier: 3.0,
      leaderBaseAmount: 1000,
      leaderROIEnabled: false,
      levelIncomeMode: 'ACHIEVEMENT_BASED', // ACHIEVEMENT_BASED or REFERRAL_BASED (disabled)
      achievementLevelIncomeEnabled: true,
      referralLevelIncomeEnabled: false
    }
  })

  useEffect(() => {
    if (programConfig) {
      reset(programConfig)
    }
  }, [programConfig, reset])

  const onSubmit = async (data) => {
    try {
      await setDoc(doc(db, 'adminConfig', 'programs'), {
        enableInvestorProgram: data.enableInvestorProgram === true || data.enableInvestorProgram === 'true',
        enableLeaderProgram: data.enableLeaderProgram === true || data.enableLeaderProgram === 'true',
        investorCapMultiplier: parseFloat(data.investorCapMultiplier) || 2.0,
        leaderCapMultiplier: parseFloat(data.leaderCapMultiplier) || 3.0,
        leaderBaseAmount: parseFloat(data.leaderBaseAmount) || 1000,
        leaderROIEnabled: false, // Always disabled for leaders
        levelIncomeMode: data.levelIncomeMode || 'ACHIEVEMENT_BASED',
        achievementLevelIncomeEnabled: data.achievementLevelIncomeEnabled === true || data.achievementLevelIncomeEnabled === 'true',
        referralLevelIncomeEnabled: false, // Always disabled
        updatedAt: new Date()
      }, { merge: true })
      
      toast.success('Program settings updated successfully')
    } catch (error) {
      console.error('Program settings update error:', error)
      toast.error('Error updating program settings: ' + (error.message || 'Unknown error'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const enableInvestorProgram = watch('enableInvestorProgram')
  const enableLeaderProgram = watch('enableLeaderProgram')
  const levelIncomeMode = watch('levelIncomeMode')

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <Settings className="text-primary" size={32} />
        Program Settings
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Program Enable/Disable */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <CheckCircle className="text-primary" size={24} />
            Enable Programs
          </h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('enableInvestorProgram')}
                className="w-5 h-5"
              />
              <div>
                <div className="font-semibold">Investor Program</div>
                <div className="text-sm text-gray-400">Enable 2× cap program with paid activation</div>
              </div>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('enableLeaderProgram')}
                className="w-5 h-5"
              />
              <div>
                <div className="font-semibold">Leader Program</div>
                <div className="text-sm text-gray-400">Enable 3× cap program with zero activation</div>
              </div>
            </label>
          </div>
        </div>

        {/* Investor Program Settings */}
        {enableInvestorProgram && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <DollarSign className="text-primary" size={24} />
              Investor Program Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Cap Multiplier (e.g., 2.0 for 2×)
                </label>
                <input
                  type="number"
                  step="0.1"
                  {...register('investorCapMultiplier', { 
                    required: 'Cap multiplier is required',
                    min: { value: 1, message: 'Must be at least 1' }
                  })}
                  className="input-field"
                />
                {errors.investorCapMultiplier && (
                  <p className="text-red-500 text-sm mt-1">{errors.investorCapMultiplier.message}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Investors can earn until they reach 2× their activation amount
                </p>
              </div>
              
              <div className="bg-blue-500 bg-opacity-20 border border-blue-500 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="text-blue-500 flex-shrink-0 mt-0.5" size={20} />
                  <div className="text-sm text-blue-300">
                    <p className="font-semibold mb-1">Investor Program Features:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Paid activation required</li>
                      <li>ROI earnings enabled</li>
                      <li>Level income enabled (achievement-based)</li>
                      <li>2× cap multiplier</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leader Program Settings */}
        {enableLeaderProgram && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="text-primary" size={24} />
              Leader Program Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Cap Multiplier (e.g., 3.0 for 3×)
                </label>
                <input
                  type="number"
                  step="0.1"
                  {...register('leaderCapMultiplier', { 
                    required: 'Cap multiplier is required',
                    min: { value: 1, message: 'Must be at least 1' }
                  })}
                  className="input-field"
                />
                {errors.leaderCapMultiplier && (
                  <p className="text-red-500 text-sm mt-1">{errors.leaderCapMultiplier.message}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Leaders can earn until they reach 3× the base amount
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Leader Base Amount (INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('leaderBaseAmount', { 
                    required: 'Base amount is required',
                    min: { value: 0, message: 'Must be 0 or greater' }
                  })}
                  className="input-field"
                />
                {errors.leaderBaseAmount && (
                  <p className="text-red-500 text-sm mt-1">{errors.leaderBaseAmount.message}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Base amount used to calculate 3× cap (even though activation is free)
                </p>
              </div>

              <div className="bg-yellow-500 bg-opacity-20 border border-yellow-500 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
                  <div className="text-sm text-yellow-300">
                    <p className="font-semibold mb-1">Leader Program Rules (Locked):</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Activation cost: ₹0 (FREE)</li>
                      <li>ROI: DISABLED (cannot be enabled)</li>
                      <li>Level income: Achievement-based ONLY</li>
                      <li>Referral income: DISABLED (cannot be enabled)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-red-500 bg-opacity-20 border border-red-500 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="text-red-500" size={20} />
                  <p className="text-sm text-red-300">
                    <strong>Note:</strong> ROI for Leaders is permanently disabled. Leaders only earn through achievement-based level income.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Level Income Mode */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="text-primary" size={24} />
            Level Income Configuration
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Level Income Mode</label>
              <select
                {...register('levelIncomeMode')}
                className="input-field"
                disabled
              >
                <option value="ACHIEVEMENT_BASED">Achievement-Based (ENABLED)</option>
                <option value="REFERRAL_BASED">Referral-Based (DISABLED)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Level income is based on achievements/tasks, NOT referrals
              </p>
            </div>

            <div className="bg-green-500 bg-opacity-20 border border-green-500 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-green-300">
                  <p className="font-semibold mb-1">Achievement-Based Level Income:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Users earn based on completing tasks/achievements</li>
                    <li>Not based on referrals or downline</li>
                    <li>Configured in "Levels / Rewards" manager</li>
                    <li>Available for both Investor and Leader programs</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-red-500 bg-opacity-20 border border-red-500 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-red-300">
                  <p className="font-semibold mb-1">Referral-Based Level Income:</p>
                  <p>This mode is DISABLED. No referral income is distributed in the system.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary">
          Save Program Settings
        </button>
      </form>
    </div>
  )
}

