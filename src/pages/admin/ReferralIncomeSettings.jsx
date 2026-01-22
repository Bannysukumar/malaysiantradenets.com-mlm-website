import { useFirestore } from '../../hooks/useFirestore'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { getFunctions, httpsCallable } from 'firebase/functions'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Settings, IndianRupee, AlertCircle, CheckCircle, Shield, Plus, X } from 'lucide-react'
import { useEffect, useState, useCallback, useRef } from 'react'

export default function AdminReferralIncomeSettings() {
  const { data: referralConfig, loading } = useFirestore(doc(db, 'adminConfig', 'referralIncome'))
  
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    defaultValues: referralConfig || {
      enableReferralIncomeGlobal: true,
      enableInvestorReferralIncome: true,
      enableLeaderReferralIncome: false, // Locked OFF
      directReferralPercent: 5.0,
      enableMultiLevelIncome: true,
      maxLevels: 25,
      levelReferralPercents: [
        { levelFrom: 1, levelTo: 1, percent: 15 },
        { levelFrom: 2, levelTo: 2, percent: 10 },
        { levelFrom: 3, levelTo: 3, percent: 8 },
        { levelFrom: 4, levelTo: 4, percent: 10 },
        { levelFrom: 5, levelTo: 5, percent: 6 },
        { levelFrom: 6, levelTo: 7, percent: 5 },
        { levelFrom: 8, levelTo: 9, percent: 4 },
        { levelFrom: 10, levelTo: 10, percent: 3 },
        { levelFrom: 11, levelTo: 25, percent: 2 }
      ],
      enableQualificationRules: true,
      qualificationRules: {
        level1to3: { minDirects: 5 },
        level4to13: { directsPerLevel: 2 }, // 1 direct for every 2 levels
        level14to25: { directsPerLevel: 3 } // 1 direct for every 3 levels
      },
      referralIncomeCountsTowardCap: true,
      referralIncomeEligibleStatuses: ['ACTIVE_INVESTOR'], // Only on activation
      referralIncomePayoutMode: 'INSTANT_TO_WALLET',
      minActivationAmountForReferral: 0,
      antiAbuseLimits: {
        maxReferralIncomePerDay: 0, // 0 = unlimited
        maxPerReferredUser: 0, // 0 = unlimited
        blockSelfReferral: true,
        blockCircularReferral: true
      }
    }
  })

  const hasInitialized = useRef(false)
  
  useEffect(() => {
    // Only reset form on initial load, not on subsequent updates
    if (referralConfig && !hasInitialized.current) {
      reset(referralConfig)
      hasInitialized.current = true
    }
  }, [referralConfig, reset])

  const onSubmit = async (data) => {
    try {
      // Process level percentages
      const levelPercentages = Array.isArray(data.levelReferralPercents) 
        ? data.levelReferralPercents
            .filter(lp => lp && lp.levelFrom && lp.levelTo && lp.percent)
            .map(lp => ({
              levelFrom: parseInt(lp.levelFrom) || 0,
              levelTo: parseInt(lp.levelTo) || 0,
              percent: parseFloat(lp.percent) || 0
            }))
        : [];

      // Calculate total percentage
      const totalPercent = levelPercentages.reduce((sum, lp) => {
        const levelCount = lp.levelTo - lp.levelFrom + 1
        return sum + (lp.percent * levelCount)
      }, 0)

      // Validate total percentage (should be 100%)
      if (Math.abs(totalPercent - 100) > 0.01) {
        toast.error(`Total level income must equal 100%. Current total: ${totalPercent.toFixed(2)}%`)
        return
      }

      await setDoc(doc(db, 'adminConfig', 'referralIncome'), {
        enableReferralIncomeGlobal: data.enableReferralIncomeGlobal === true || data.enableReferralIncomeGlobal === 'true',
        enableInvestorReferralIncome: data.enableInvestorReferralIncome === true || data.enableInvestorReferralIncome === 'true',
        enableLeaderReferralIncome: false, // Always locked OFF
        directReferralPercent: parseFloat(data.directReferralPercent) || 5.0,
        enableMultiLevelIncome: data.enableMultiLevelIncome === true || data.enableMultiLevelIncome === 'true',
        maxLevels: parseInt(data.maxLevels) || 25,
        levelReferralPercents: levelPercentages,
        enableQualificationRules: data.enableQualificationRules === true || data.enableQualificationRules === 'true',
        qualificationRules: {
          level1to3: { minDirects: parseInt(data.qualificationRules?.level1to3?.minDirects) || 5 },
          level4to13: { directsPerLevel: parseInt(data.qualificationRules?.level4to13?.directsPerLevel) || 2 },
          level14to25: { directsPerLevel: parseInt(data.qualificationRules?.level14to25?.directsPerLevel) || 3 }
        },
        referralIncomeCountsTowardCap: data.referralIncomeCountsTowardCap === true || data.referralIncomeCountsTowardCap === 'true',
        referralIncomeEligibleStatuses: data.referralIncomeEligibleStatuses || ['ACTIVE_INVESTOR'],
        referralIncomePayoutMode: data.referralIncomePayoutMode || 'INSTANT_TO_WALLET',
        minActivationAmountForReferral: parseFloat(data.minActivationAmountForReferral) || 0,
        antiAbuseLimits: {
          maxReferralIncomePerDay: parseFloat(data.antiAbuseLimits?.maxReferralIncomePerDay) || 0,
          maxPerReferredUser: parseFloat(data.antiAbuseLimits?.maxPerReferredUser) || 0,
          blockSelfReferral: data.antiAbuseLimits?.blockSelfReferral === true || data.antiAbuseLimits?.blockSelfReferral === 'true',
          blockCircularReferral: data.antiAbuseLimits?.blockCircularReferral === true || data.antiAbuseLimits?.blockCircularReferral === 'true'
        },
        updatedAt: new Date()
      }, { merge: true })
      
      toast.success('Referral income settings updated successfully')
    } catch (error) {
      console.error('Referral income settings update error:', error)
      toast.error('Error updating referral income settings: ' + (error.message || 'Unknown error'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const enableReferralIncomeGlobal = watch('enableReferralIncomeGlobal')
  const enableInvestorReferralIncome = watch('enableInvestorReferralIncome')

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <IndianRupee className="text-primary" size={32} />
        Referral Income Settings
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Global Toggles */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Settings className="text-primary" size={24} />
            Global Settings
          </h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('enableReferralIncomeGlobal')}
                className="w-5 h-5"
              />
              <div>
                <div className="font-semibold">Enable Referral Income Globally</div>
                <div className="text-sm text-gray-400">
                  Master switch for all referral income features
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('enableInvestorReferralIncome')}
                disabled={!enableReferralIncomeGlobal}
                className="w-5 h-5"
              />
              <div>
                <div className="font-semibold">Enable Investor Referral Income</div>
                <div className="text-sm text-gray-400">
                  Investors can earn referral income when their referrals activate
                </div>
              </div>
            </label>

            <div className="bg-red-500 bg-opacity-20 border border-red-500 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-red-300">
                  <p className="font-semibold mb-1">Leader Referral Income: LOCKED OFF</p>
                  <p>Leaders cannot earn referral income. This setting cannot be enabled.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Investor Referral Configuration */}
        {enableReferralIncomeGlobal && enableInvestorReferralIncome && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <IndianRupee className="text-primary" size={24} />
              Investor Referral Income Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Direct Referral Percentage (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  {...register('directReferralPercent', { 
                    required: 'Direct referral percent is required',
                    min: { value: 0, message: 'Must be 0 or greater' },
                    max: { value: 100, message: 'Cannot exceed 100%' }
                  })}
                  className="input-field"
                />
                {errors.directReferralPercent && (
                  <p className="text-red-500 text-sm mt-1">{errors.directReferralPercent.message}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Percentage of activation amount paid to referrer (e.g., 5% of ₹10,000 = ₹500)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Minimum Activation Amount for Referral</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('minActivationAmountForReferral')}
                  className="input-field"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Only pay referral income if referee activates with at least this amount (0 = no minimum)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Payout Mode</label>
                <select
                  {...register('referralIncomePayoutMode')}
                  className="input-field"
                >
                  <option value="INSTANT_TO_WALLET">Instant to Wallet</option>
                  <option value="PENDING_APPROVAL">Pending Approval (Admin Review)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  How referral income is credited to referrer's wallet
                </p>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('referralIncomeCountsTowardCap')}
                  className="w-5 h-5"
                />
                <div>
                  <div className="font-semibold">Referral Income Counts Toward Cap</div>
                  <div className="text-sm text-gray-400">
                    If enabled, referral income adds to eligible earnings total (Investor hits 2× cap faster)
                  </div>
                </div>
              </label>

              <div>
                <label className="block text-sm font-medium mb-2">When to Credit Referral Income</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      value="ACTIVE_INVESTOR"
                      {...register('referralIncomeEligibleStatuses')}
                      className="w-4 h-4"
                    />
                    <span>When referee activates as Investor (Recommended)</span>
                  </label>
                  <p className="text-xs text-gray-400 ml-6">
                    Referral income is credited only when the referred user successfully activates an Investor package
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Multi-Level Income Configuration */}
        {enableReferralIncomeGlobal && enableInvestorReferralIncome && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <IndianRupee className="text-primary" size={24} />
              Multi-Level Income Configuration
            </h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('enableMultiLevelIncome')}
                  className="w-5 h-5"
                />
                <div>
                  <div className="font-semibold">Enable Multi-Level Income</div>
                  <div className="text-sm text-gray-400">
                    Distribute referral income to multiple levels in the upline chain (Level 1-25)
                  </div>
                </div>
              </label>

              {watch('enableMultiLevelIncome') && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Maximum Levels</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="50"
                      {...register('maxLevels', { 
                        min: { value: 1, message: 'Must be at least 1' },
                        max: { value: 50, message: 'Cannot exceed 50 levels' }
                      })}
                      className="input-field"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Maximum number of levels to distribute income (default: 25)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Level Percentages (On ROI - Investor)</label>
                    <p className="text-xs text-gray-400 mb-3">
                      Configure percentage for each level. <strong>Total must equal 100%</strong>
                    </p>
                    <LevelPercentagesEditor 
                      register={register}
                      watch={watch}
                      setValue={setValue}
                    />
                  </div>

                  {/* Qualification Rules */}
                  <div className="mt-6">
                    <label className="flex items-center gap-3 cursor-pointer mb-4">
                      <input
                        type="checkbox"
                        {...register('enableQualificationRules')}
                        className="w-5 h-5"
                      />
                      <div>
                        <div className="font-semibold">Enable Qualification Rules</div>
                        <div className="text-sm text-gray-400">
                          Require minimum direct referrals to qualify for level income
                        </div>
                      </div>
                    </label>

                    {watch('enableQualificationRules') && (
                      <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-4 space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-2">Level 1-3: Minimum Directs</label>
                          <input
                            type="number"
                            min="0"
                            {...register('qualificationRules.level1to3.minDirects')}
                            className="input-field"
                            defaultValue="5"
                          />
                          <p className="text-xs text-gray-400 mt-1">Requires 5 direct referrals for levels 1-3</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Level 4-13: Directs Per Level Ratio</label>
                          <input
                            type="number"
                            min="1"
                            {...register('qualificationRules.level4to13.directsPerLevel')}
                            className="input-field"
                            defaultValue="2"
                          />
                          <p className="text-xs text-gray-400 mt-1">1 Direct for every 2 Levels (e.g., Level 4 = 2 directs, Level 6 = 3 directs)</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Level 14-25: Directs Per Level Ratio</label>
                          <input
                            type="number"
                            min="1"
                            {...register('qualificationRules.level14to25.directsPerLevel')}
                            className="input-field"
                            defaultValue="3"
                          />
                          <p className="text-xs text-gray-400 mt-1">1 Direct for every 3 Levels (e.g., Level 14 = 5 directs, Level 16 = 6 directs)</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Anti-Abuse Settings */}
        {enableReferralIncomeGlobal && enableInvestorReferralIncome && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Shield className="text-primary" size={24} />
              Anti-Abuse Protection
            </h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('antiAbuseLimits.blockSelfReferral')}
                  className="w-5 h-5"
                />
                <div>
                  <div className="font-semibold">Block Self-Referral</div>
                  <div className="text-sm text-gray-400">
                    Prevent users from referring themselves
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('antiAbuseLimits.blockCircularReferral')}
                  className="w-5 h-5"
                />
                <div>
                  <div className="font-semibold">Block Circular Referral Chains</div>
                  <div className="text-sm text-gray-400">
                    Prevent circular referral chains (A refers B, B refers A)
                  </div>
                </div>
              </label>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Max Referral Income Per Day (0 = unlimited)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('antiAbuseLimits.maxReferralIncomePerDay')}
                  className="input-field"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Limit total referral income a user can earn per day
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Max Referral Income Per Referred User (0 = unlimited)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('antiAbuseLimits.maxPerReferredUser')}
                  className="input-field"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Limit referral income from a single referred user
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Hard Rules Display */}
        <div className="card border-yellow-500 border-2">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <AlertCircle className="text-yellow-500" size={24} />
            Hard Enforcement Rules
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
              <div>
                <strong>Leader Uplines:</strong> Leaders cannot receive referral income, even if their referral activates as Investor
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
              <div>
                <strong>Leader Referees:</strong> If a referred user activates as Leader (free), no referral income is generated
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
              <div>
                <strong>Investor Only:</strong> Referral income is paid only to ACTIVE_INVESTOR uplines when referee activates as Investor
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
              <div>
                <strong>Activation Trigger:</strong> Referral income is credited on Investor activation, not on signup
              </div>
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary">
          Save Referral Income Settings
        </button>
      </form>

      {/* Bulk Processing Section */}
      <div className="card mt-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <AlertCircle className="text-yellow-500" size={24} />
          Process Pending Referral Income
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          This will process referral income for all existing ACTIVE_INVESTOR users who have active packages but haven't received referral income yet. 
          Use this if you've just enabled multi-level income or if some activations didn't trigger referral income automatically.
        </p>
        <ProcessAllPendingReferralIncomeButton />
      </div>

      {/* Wallet Sync Section */}
      <div className="card mt-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <IndianRupee className="text-green-500" size={24} />
          Sync Wallet Balances
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Sync wallet balances from users collection to wallets collection. Use this if wallet balances are not showing correctly in the Admin Users page.
          This will migrate existing balances from users.walletBalance to wallets.availableBalance.
        </p>
        <SyncWalletBalancesButton />
      </div>
    </div>
  )
}

// Component to process all pending referral income
function ProcessAllPendingReferralIncomeButton() {
  const [processing, setProcessing] = useState(false)
  const [autoProcessing, setAutoProcessing] = useState(false)
  const functions = getFunctions()

  // Internal function for automatic processing (no confirmation)
  const processAllInternal = useCallback(async (forceReprocess = false) => {
    if (processing) return // Skip if already processing
    
    setAutoProcessing(true)
    try {
      const processAll = httpsCallable(functions, 'processAllPendingReferralIncome')
      const result = await processAll({ forceReprocess })
      
      if (result.data.success && result.data.processed > 0) {
        // Only show toast if something was processed
        let message = `Auto-processed ${result.data.processed} referral income distributions. ` +
          `Skipped: ${result.data.skipped}, Errors: ${result.data.errors}`
        toast.success(message, { duration: 5000 })
      }
    } catch (error) {
      console.error('Error auto-processing referral income:', error)
      // Don't show error toast for automatic processing to avoid spam
    } finally {
      setAutoProcessing(false)
    }
  }, [processing, functions])

  const handleProcessAll = async (forceReprocess = false) => {
    const message = forceReprocess 
      ? 'Are you sure you want to FORCE REPROCESS referral income for ALL existing activations? This will create new entries even if they already exist. Use this only if wallet credits are missing.'
      : 'Are you sure you want to process referral income for ALL existing activations? This may take a few minutes.'
    
    if (!confirm(message)) {
      return
    }

    setProcessing(true)
    try {
      const processAll = httpsCallable(functions, 'processAllPendingReferralIncome')
      const result = await processAll({ forceReprocess })
      
      if (result.data.success) {
        let message = `Successfully processed ${result.data.processed} referral income distributions. ` +
          `Skipped: ${result.data.skipped}, Errors: ${result.data.errors}`
        
        // Show detailed skip reasons if available
        if (result.data.skipReasons) {
          const reasons = result.data.skipReasons
          const reasonDetails = []
          if (reasons.alreadyProcessed > 0) reasonDetails.push(`${reasons.alreadyProcessed} already processed`)
          if (reasons.referrerNotActiveInvestor > 0) reasonDetails.push(`${reasons.referrerNotActiveInvestor} referrer not ACTIVE_INVESTOR`)
          if (reasons.noReferrer > 0) reasonDetails.push(`${reasons.noReferrer} no referrer`)
          if (reasons.noActivePackages > 0) reasonDetails.push(`${reasons.noActivePackages} no active packages`)
          if (reasons.referrerNotFound > 0) reasonDetails.push(`${reasons.referrerNotFound} referrer not found`)
          if (reasons.zeroAmount > 0) reasonDetails.push(`${reasons.zeroAmount} zero amount`)
          
          if (reasonDetails.length > 0) {
            message += `\n\nSkip reasons: ${reasonDetails.join(', ')}`
          }
        }
        
        toast.success(message, { duration: 8000 })
      } else {
        toast.error(result.data.message || 'Error processing referral income')
      }
    } catch (error) {
      console.error('Error processing all referral income:', error)
      toast.error(error.message || 'Error processing referral income')
    } finally {
      setProcessing(false)
    }
  }

  // Auto-process every 20 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!processing) {
        processAllInternal(false) // Auto-process without force reprocess
      }
    }, 20000) // 20 seconds

    return () => clearInterval(interval)
  }, [processing, processAllInternal])

  return (
    <div className="flex flex-col gap-3">
      {autoProcessing && (
        <div className="p-2 bg-blue-500/10 border border-blue-500 rounded-lg text-sm text-blue-400 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-400"></div>
          Auto-processing every 20 seconds...
        </div>
      )}
      <button
        type="button"
        onClick={() => handleProcessAll(false)}
        disabled={processing || autoProcessing}
        className="btn-primary flex items-center gap-2"
      >
        {processing ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            Processing...
          </>
        ) : (
          <>
            <CheckCircle size={20} />
            Process All Pending Referral Income
          </>
        )}
      </button>
      
      <button
        type="button"
        onClick={() => handleProcessAll(true)}
        disabled={processing || autoProcessing}
        className="btn-secondary flex items-center gap-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-white"
      >
        <AlertCircle size={20} />
        Force Reprocess (Fix Missing Wallet Credits)
      </button>
      <p className="text-xs text-gray-400">
        Use "Force Reprocess" only if referral income entries exist but wallet wasn't credited. This will create new entries even if duplicates exist.
        <br />
        <span className="text-green-400">✓ Auto-processing enabled: Runs every 20 seconds</span>
      </p>
    </div>
  )
}

// Component to sync wallet balances
function SyncWalletBalancesButton() {
  const [processing, setProcessing] = useState(false)
  const [autoSyncing, setAutoSyncing] = useState(false)
  const functions = getFunctions()

  // Internal function for automatic syncing (no confirmation)
  const syncInternal = useCallback(async () => {
    if (processing) return // Skip if already processing
    
    setAutoSyncing(true)
    try {
      const syncBalances = httpsCallable(functions, 'syncWalletBalances')
      const result = await syncBalances({})
      
      if (result.data.success && result.data.synced > 0) {
        // Only show toast if something was synced
        toast.success(
          `Auto-synced ${result.data.synced} wallet balances. ` +
          `Created: ${result.data.created}, Updated: ${result.data.updated}`,
          { duration: 5000 }
        )
      }
    } catch (error) {
      console.error('Error auto-syncing wallet balances:', error)
      // Don't show error toast for automatic syncing to avoid spam
    } finally {
      setAutoSyncing(false)
    }
  }, [processing, functions])

  const handleSync = async () => {
    if (!confirm('Are you sure you want to sync all wallet balances? This will migrate balances from users collection to wallets collection.')) {
      return
    }

    setProcessing(true)
    try {
      const syncBalances = httpsCallable(functions, 'syncWalletBalances')
      const result = await syncBalances({})
      
      if (result.data.success) {
        toast.success(
          `Successfully synced ${result.data.synced} wallet balances. ` +
          `Created: ${result.data.created}, Updated: ${result.data.updated}, Skipped: ${result.data.skipped}`,
          { duration: 8000 }
        )
      } else {
        toast.error(result.data.message || 'Error syncing wallet balances')
      }
    } catch (error) {
      console.error('Error syncing wallet balances:', error)
      toast.error(error.message || 'Error syncing wallet balances')
    } finally {
      setProcessing(false)
    }
  }

  // Auto-sync every 20 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!processing) {
        syncInternal() // Auto-sync without confirmation
      }
    }, 20000) // 20 seconds

    return () => clearInterval(interval)
  }, [processing, syncInternal])

  return (
    <div className="flex flex-col gap-3">
      {autoSyncing && (
        <div className="p-2 bg-blue-500/10 border border-blue-500 rounded-lg text-sm text-blue-400 flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-400"></div>
          Auto-syncing every 20 seconds...
        </div>
      )}
      <button
        type="button"
        onClick={handleSync}
        disabled={processing || autoSyncing}
        className="btn-primary flex items-center gap-2"
      >
        {processing ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            Syncing...
          </>
        ) : (
          <>
            <CheckCircle size={20} />
            Sync Wallet Balances
          </>
        )}
      </button>
      <p className="text-xs text-gray-400">
        <span className="text-green-400">✓ Auto-syncing enabled: Runs every 20 seconds</span>
      </p>
    </div>
  )
}

// Total Percentage Display Component (for use with watch)
function TotalPercentageDisplay({ watch }) {
  const levelPercentages = watch('levelReferralPercents') || []
  const totalPercent = levelPercentages.reduce((sum, lp) => {
    const levelCount = lp.levelTo - lp.levelFrom + 1
    return sum + (lp.percent * levelCount)
  }, 0)
  const isValid = Math.abs(totalPercent - 100) < 0.01

  return (
    <div className={`mt-3 p-3 rounded-lg border ${isValid ? 'bg-green-500/20 border-green-500' : 'bg-red-500/20 border-red-500'}`}>
      <div className="flex items-center gap-2">
        <span className={`font-semibold ${isValid ? 'text-green-400' : 'text-red-400'}`}>
          Total Level Income: {totalPercent.toFixed(2)}%
        </span>
        {isValid ? (
          <CheckCircle className="text-green-400" size={16} />
        ) : (
          <AlertCircle className="text-red-400" size={16} />
        )}
      </div>
      <p className={`text-xs mt-1 ${isValid ? 'text-green-300' : 'text-red-300'}`}>
        {isValid 
          ? '✓ Total equals 100% - Valid configuration'
          : '✗ Total must equal 100% - Please adjust percentages'
        }
      </p>
    </div>
  )
}

// Total Percentage Display Component (for use with direct prop)
function TotalPercentageDisplayInline({ levelPercentages }) {
  const totalPercent = (levelPercentages || []).reduce((sum, lp) => {
    const levelCount = lp.levelTo - lp.levelFrom + 1
    return sum + (lp.percent * levelCount)
  }, 0)
  const isValid = Math.abs(totalPercent - 100) < 0.01

  return (
    <div className={`mt-3 p-3 rounded-lg border ${isValid ? 'bg-green-500/20 border-green-500' : 'bg-red-500/20 border-red-500'}`}>
      <div className="flex items-center gap-2">
        <span className={`font-semibold ${isValid ? 'text-green-400' : 'text-red-400'}`}>
          Total Level Income: {totalPercent.toFixed(2)}%
        </span>
        {isValid ? (
          <CheckCircle className="text-green-400" size={16} />
        ) : (
          <AlertCircle className="text-red-400" size={16} />
        )}
      </div>
      <p className={`text-xs mt-1 ${isValid ? 'text-green-300' : 'text-red-300'}`}>
        {isValid 
          ? '✓ Total equals 100% - Valid configuration'
          : '✗ Total must equal 100% - Please adjust percentages'
        }
      </p>
    </div>
  )
}

// Level Percentages Editor Component
function LevelPercentagesEditor({ register, watch, setValue }) {
  const levelPercentages = watch('levelReferralPercents') || []
  const defaultLevels = [
    { levelFrom: 1, levelTo: 1, percent: 15 },
    { levelFrom: 2, levelTo: 2, percent: 10 },
    { levelFrom: 3, levelTo: 3, percent: 8 },
    { levelFrom: 4, levelTo: 4, percent: 10 },
    { levelFrom: 5, levelTo: 5, percent: 6 },
    { levelFrom: 6, levelTo: 7, percent: 5 },
    { levelFrom: 8, levelTo: 9, percent: 4 },
    { levelFrom: 10, levelTo: 10, percent: 3 },
    { levelFrom: 11, levelTo: 25, percent: 2 }
  ]
  
  // Initialize local state - only use form values if they exist and are valid
  const [localLevels, setLocalLevels] = useState(() => {
    if (levelPercentages.length > 0 && Array.isArray(levelPercentages)) {
      // Validate that form values are valid level objects
      const isValid = levelPercentages.every(lp => 
        lp && typeof lp.levelFrom === 'number' && typeof lp.levelTo === 'number' && typeof lp.percent === 'number'
      )
      if (isValid) {
        return levelPercentages
      }
    }
    return defaultLevels
  })
  
  const isInitialized = useRef(false)
  const isUpdatingFromForm = useRef(false)
  const isUpdatingFromLocal = useRef(false)
  const userHasModified = useRef(false) // Track if user has made any changes
  const initialFormValueRef = useRef(JSON.stringify(levelPercentages))

  // Sync local state when form values change (e.g., from Firestore) - only on initial load
  useEffect(() => {
    // Only sync from form to local on initial load (when form has data and we haven't initialized yet)
    // AND only if user hasn't made any modifications
    if (!isInitialized.current && levelPercentages.length > 0 && !isUpdatingFromLocal.current && !userHasModified.current) {
      const formStr = JSON.stringify(levelPercentages)
      const localStr = JSON.stringify(localLevels)
      
      // Validate form values are valid
      const isValid = levelPercentages.every(lp => 
        lp && typeof lp.levelFrom === 'number' && typeof lp.levelTo === 'number' && typeof lp.percent === 'number'
      )
      
      // Only update if form values are different from local state
      if (isValid && formStr !== localStr && formStr !== initialFormValueRef.current) {
        isUpdatingFromForm.current = true
        setLocalLevels(levelPercentages)
        initialFormValueRef.current = formStr
        isInitialized.current = true
        isUpdatingFromForm.current = false
      } else if (isValid && formStr === localStr) {
        // Form values match local state, just mark as initialized
        isInitialized.current = true
        initialFormValueRef.current = formStr
      }
    } else if (!isInitialized.current && levelPercentages.length === 0) {
      // If form is empty, mark as initialized with defaults
      isInitialized.current = true
      initialFormValueRef.current = JSON.stringify(defaultLevels)
    }
    // If already initialized and user has modified, ignore form changes (prevent reset from overwriting)
  }, [levelPercentages, localLevels])

  // Sync local state changes to form
  useEffect(() => {
    // Only sync with form if we're initialized and the change came from local state (user interaction)
    if (isInitialized.current && !isUpdatingFromForm.current) {
      isUpdatingFromLocal.current = true
      userHasModified.current = true // Mark that user has made changes
      setValue('levelReferralPercents', localLevels, { shouldDirty: true, shouldValidate: false })
      initialFormValueRef.current = JSON.stringify(localLevels)
      // Reset flag after a short delay to allow form to update
      setTimeout(() => {
        isUpdatingFromLocal.current = false
      }, 100)
    }
  }, [localLevels, setValue])

  const addLevel = () => {
    const lastLevel = localLevels[localLevels.length - 1]
    const newLevelFrom = lastLevel ? lastLevel.levelTo + 1 : 1
    setLocalLevels([...localLevels, { levelFrom: newLevelFrom, levelTo: newLevelFrom + 3, percent: 1 }])
  }

  const removeLevel = (index) => {
    setLocalLevels(localLevels.filter((_, i) => i !== index))
  }

  const updateLevel = (index, field, value) => {
    const updated = [...localLevels]
    updated[index] = { ...updated[index], [field]: value }
    setLocalLevels(updated)
  }

  return (
    <div className="space-y-3">
      {localLevels.map((level, index) => (
        <div key={`level-${level.levelFrom}-${level.levelTo}-${index}`} className="flex items-center gap-2 p-3 bg-dark-lighter rounded-lg">
          <div className="flex-1 grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">From Level</label>
              <input
                type="number"
                min="1"
                value={level.levelFrom || ''}
                onChange={(e) => updateLevel(index, 'levelFrom', parseInt(e.target.value) || 0)}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">To Level</label>
              <input
                type="number"
                min="1"
                value={level.levelTo || ''}
                onChange={(e) => updateLevel(index, 'levelTo', parseInt(e.target.value) || 0)}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Percentage (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={level.percent || ''}
                onChange={(e) => updateLevel(index, 'percent', parseFloat(e.target.value) || 0)}
                className="input-field text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => removeLevel(index)}
            className="btn-secondary p-2 text-red-400 hover:bg-red-500 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addLevel}
        className="btn-secondary flex items-center gap-2 text-sm"
      >
        <Plus size={16} />
        Add Level Range
      </button>
      <p className="text-xs text-gray-400">
        Example: Levels 6-7 at 5% means users at levels 6 and 7 will receive 5% of activation amount.
        <br />
        <strong>Important:</strong> Total level income must equal 100% (Level 1-25 combined)
      </p>
      <TotalPercentageDisplayInline levelPercentages={localLevels} />
    </div>
  )
}

