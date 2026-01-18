import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useFirestore, useCollection } from '../../hooks/useFirestore'
import { doc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { UserPlus, AlertCircle, Package, Wallet } from 'lucide-react'
import { formatCurrency } from '../../utils/helpers'
import { validateEmail } from '../../utils/validation'

export default function UserActivateUser() {
  const { user, userData } = useAuth()
  const [processing, setProcessing] = useState(false)
  const [targetUser, setTargetUser] = useState(null)
  const [searching, setSearching] = useState(false)
  
  const { data: featureConfig } = useFirestore(doc(db, 'adminConfig', 'features'))
  const { data: packages } = useCollection('packages', [])
  
  const config = featureConfig || {}

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm({
    defaultValues: {
      targetEmail: '',
      planId: '',
      confirmActivation: false
    }
  })

  const targetEmail = watch('targetEmail')
  const planId = watch('planId')
  const confirmActivation = watch('confirmActivation')

  const selectedPlan = packages.find(p => p.id === planId)
  const activationAmount = selectedPlan?.inrPrice || selectedPlan?.usdPrice || 0
  const availableBalance = userData?.walletBalance || 0
  const minBalanceAfter = config.sponsorActivationMinBalanceRule || 0
  const requiredBalance = activationAmount + minBalanceAfter

  // Filter allowed plans
  const allowedPlans = config.sponsorActivationAllowedPlans?.length > 0
    ? packages.filter(p => config.sponsorActivationAllowedPlans.includes(p.id))
    : packages

  const searchTargetUser = async (email) => {
    if (!email || !validateEmail(email)) {
      setTargetUser(null)
      return
    }

    setSearching(true)
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', email.toLowerCase().trim())
      )
      const snapshot = await getDocs(usersQuery)
      
      if (snapshot.empty) {
        setTargetUser(null)
        toast.error('User not found with this email')
      } else {
        const userDoc = snapshot.docs[0]
        const userData = userDoc.data()
        
        if (userData.status === 'blocked') {
          setTargetUser(null)
          toast.error('Target user account is blocked')
        } else if (userDoc.id === user?.uid) {
          setTargetUser(null)
          toast.error('You cannot activate your own account')
        } else {
          setTargetUser({
            uid: userDoc.id,
            email: userData.email,
            name: userData.name,
            status: userData.status
          })
        }
      }
    } catch (error) {
      console.error('Search error:', error)
      toast.error('Error searching for user')
      setTargetUser(null)
    } finally {
      setSearching(false)
    }
  }

  // useEffect MUST be called before any early returns
  useEffect(() => {
    if (!config.enableSponsorActivation) return // Don't search if feature is disabled
    
    if (targetEmail && validateEmail(targetEmail)) {
      const timeoutId = setTimeout(() => {
        searchTargetUser(targetEmail)
      }, 500)
      return () => clearTimeout(timeoutId)
    } else {
      setTargetUser(null)
    }
  }, [targetEmail, config.enableSponsorActivation])

  // Check if sponsor activation is enabled - AFTER all hooks
  if (!config.enableSponsorActivation) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Activate User</h1>
        <div className="card">
          <div className="text-center py-12">
            <AlertCircle className="text-gray-400 mx-auto mb-4" size={48} />
            <p className="text-gray-400 text-lg mb-2">Sponsor Activation is currently unavailable</p>
            <p className="text-gray-500 text-sm">
              This feature has been disabled by the administrator.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const onSubmit = async (data) => {
    try {
      if (!targetUser) {
        toast.error('Please search and select a valid target user')
        return
      }

      if (!data.confirmActivation) {
        toast.error('Please confirm the activation details')
        return
      }

      if (requiredBalance > availableBalance) {
        toast.error(`Insufficient balance. Required: ${formatCurrency(requiredBalance, 'INR')}`)
        return
      }

      setProcessing(true)

      // Create activation via Cloud Function
      const { httpsCallable } = await import('firebase/functions')
      const { functions } = await import('../../config/firebase')
      const createActivation = httpsCallable(functions, 'createSponsorActivation')
      
      const result = await createActivation({
        targetUid: targetUser.uid,
        targetEmail: targetUser.email,
        planId: data.planId,
        amount: activationAmount
      })

      if (result.data.success) {
        toast.success('User activation successful!')
        setValue('targetEmail', '')
        setValue('planId', '')
        setValue('confirmActivation', false)
        setTargetUser(null)
      } else {
        toast.error(result.data.error || 'Failed to activate user')
      }
    } catch (error) {
      console.error('Activation error:', error)
      toast.error(error.message || 'Error processing activation')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <UserPlus className="text-primary" size={32} />
        Activate User Account
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-xl font-bold mb-6">Activation Details</h2>

            <div className="mb-6 p-4 bg-dark-lighter rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">Available Balance</span>
                <span className="text-2xl font-bold text-primary">{formatCurrency(availableBalance, 'INR')}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Target User Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  {...register('targetEmail', { 
                    required: 'Target user email is required',
                    validate: (value) => validateEmail(value) || true
                  })}
                  className="input-field"
                  placeholder="Enter target user email address"
                />
                {errors.targetEmail && (
                  <p className="text-red-500 text-sm mt-1">{errors.targetEmail.message}</p>
                )}
                {searching && (
                  <p className="text-gray-400 text-sm mt-1">Searching...</p>
                )}
                {targetUser && (
                  <div className="mt-2 p-3 bg-green-500/10 border border-green-500 rounded-lg">
                    <p className="text-sm text-green-500">
                      ✓ User found: {targetUser.name} ({targetUser.email})
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Package <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('planId', { required: 'Please select a package' })}
                  className="input-field"
                >
                  <option value="">Select a package...</option>
                  {allowedPlans.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} - {formatCurrency(pkg.inrPrice || pkg.usdPrice, 'INR')}
                    </option>
                  ))}
                </select>
                {errors.planId && (
                  <p className="text-red-500 text-sm mt-1">{errors.planId.message}</p>
                )}
              </div>

              {selectedPlan && (
                <div className="p-4 bg-dark-lighter rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Package:</span>
                    <span className="font-semibold">{selectedPlan.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Activation Amount:</span>
                    <span className="font-bold text-primary">{formatCurrency(activationAmount, 'INR')}</span>
                  </div>
                  {minBalanceAfter > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Min Balance After:</span>
                      <span className="text-yellow-500">{formatCurrency(minBalanceAfter, 'INR')}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-gray-700">
                    <span className="font-semibold">Required Balance:</span>
                    <span className={`font-bold ${requiredBalance > availableBalance ? 'text-red-500' : 'text-green-500'}`}>
                      {formatCurrency(requiredBalance, 'INR')}
                    </span>
                  </div>
                  {requiredBalance > availableBalance && (
                    <p className="text-red-500 text-sm mt-2">Insufficient balance</p>
                  )}
                </div>
              )}

              <div className="p-4 bg-yellow-500/10 border border-yellow-500 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-yellow-500 mt-0.5" size={20} />
                  <div className="flex-1">
                    <p className="text-sm text-yellow-500 font-semibold mb-2">Important:</p>
                    <ul className="text-xs text-yellow-500/80 space-y-1 list-disc list-inside">
                      <li>Activation cannot be reversed once completed</li>
                      <li>Target user will receive immediate package activation</li>
                      <li>Ensure you have sufficient balance</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register('confirmActivation', { 
                    required: 'You must confirm the activation details'
                  })}
                  className="w-4 h-4"
                />
                <label className="text-sm">
                  I confirm the activation details and understand this cannot be reversed <span className="text-red-500">*</span>
                </label>
              </div>
              {errors.confirmActivation && (
                <p className="text-red-500 text-sm">{errors.confirmActivation.message}</p>
              )}

              <button
                type="submit"
                disabled={processing || !targetUser || !selectedPlan || requiredBalance > availableBalance || !confirmActivation}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <UserPlus size={20} />
                    Activate User
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <div>
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <AlertCircle className="text-primary" size={24} />
              Activation Information
            </h2>
            <div className="space-y-3 text-sm text-gray-400">
              <p>• Target user must be registered in the system</p>
              <p>• Target user account must be active</p>
              {config.sponsorActivationDailyLimit && (
                <p>• Daily limit: {config.sponsorActivationDailyLimit} activations</p>
              )}
              {config.sponsorActivationDailyAmountLimit && (
                <p>• Daily amount limit: {formatCurrency(config.sponsorActivationDailyAmountLimit, 'INR')}</p>
              )}
              {minBalanceAfter > 0 && (
                <p>• You must keep {formatCurrency(minBalanceAfter, 'INR')} in wallet after activation</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

