import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useFirestore } from '../../hooks/useFirestore'
import { doc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Send, AlertCircle, Wallet, DollarSign } from 'lucide-react'
import { formatCurrency } from '../../utils/helpers'
import { validateEmail } from '../../utils/validation'

export default function UserTransfer() {
  const { user, userData } = useAuth()
  const userId = user?.uid
  const [processing, setProcessing] = useState(false)
  const [lastTransferTime, setLastTransferTime] = useState(null)
  
  const { data: featureConfig } = useFirestore(doc(db, 'adminConfig', 'features'))
  const config = featureConfig || {}
  
  // Get wallet data from wallets collection
  const walletRef = userId ? doc(db, 'wallets', userId) : null
  const { data: walletData } = useFirestore(walletRef)
  
  // Use wallet data if available, fallback to userData for backward compatibility
  const availableBalance = walletData?.availableBalance ?? userData?.walletBalance ?? 0

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm({
    defaultValues: {
      recipientEmail: '',
      amount: '',
      note: '',
      confirmEmail: false
    }
  })

  const amount = watch('amount')
  const recipientEmail = watch('recipientEmail')
  const confirmEmail = watch('confirmEmail')

  // Calculate fee
  const feeAmount = config.enableTransferFee && amount ? (
    config.transferFeeType === 'percent' 
      ? (parseFloat(amount) * (config.transferFeeValue || 0)) / 100
      : (config.transferFeeValue || 0)
  ) : 0

  const totalDeduction = amount ? parseFloat(amount) + feeAmount : 0

  // Check eligibility - MUST be called before any early returns
  useEffect(() => {
    if (!config.enableUserTransfers) return // Don't show errors if feature is disabled
    
    if (config.requireKycForTransfers && !userData?.kycVerified) {
      toast.error('KYC verification is required to send transfers')
    }
    if (config.requireEmailVerifiedForTransfers && !user?.emailVerified) {
      toast.error('Email verification is required to send transfers')
    }
  }, [config, user, userData])

  // Check if transfers are enabled - AFTER all hooks
  if (!config.enableUserTransfers) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Transfer Funds</h1>
        <div className="card">
          <div className="text-center py-12">
            <AlertCircle className="text-gray-400 mx-auto mb-4" size={48} />
            <p className="text-gray-400 text-lg mb-2">Transfers are currently unavailable</p>
            <p className="text-gray-500 text-sm">
              This feature has been disabled by the administrator.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const checkCooldown = async () => {
    if (!config.transferCooldownMinutes) return true

    const cooldownMs = config.transferCooldownMinutes * 60 * 1000
    const now = Date.now()

    // Check last transfer from this user
    const transfersQuery = query(
      collection(db, 'transfers'),
      where('senderUid', '==', user?.uid),
      where('status', '==', 'completed')
    )
    const snapshot = await getDocs(transfersQuery)
    
    if (!snapshot.empty) {
      const lastTransfer = snapshot.docs
        .map(doc => ({ ...doc.data(), createdAt: doc.data().createdAt?.toDate?.() || new Date(doc.data().createdAt) }))
        .sort((a, b) => b.createdAt - a.createdAt)[0]
      
      const timeSinceLastTransfer = now - lastTransfer.createdAt.getTime()
      if (timeSinceLastTransfer < cooldownMs) {
        const remainingMinutes = Math.ceil((cooldownMs - timeSinceLastTransfer) / 60000)
        toast.error(`Please wait ${remainingMinutes} more minutes before sending another transfer`)
        return false
      }
    }
    return true
  }

  const onSubmit = async (data) => {
    try {
      // Validate email
      const emailError = validateEmail(data.recipientEmail)
      if (emailError) {
        toast.error(emailError)
        return
      }

      // Check confirmation
      if (!data.confirmEmail) {
        toast.error('Please confirm that the recipient email is correct')
        return
      }

      // Check cooldown
      const canTransfer = await checkCooldown()
      if (!canTransfer) return

      // Check self-transfer
      if (data.recipientEmail.toLowerCase() === user?.email?.toLowerCase()) {
        toast.error('You cannot transfer funds to yourself')
        return
      }

      setProcessing(true)

      // Create transfer via Cloud Function
      const { httpsCallable } = await import('firebase/functions')
      const { functions } = await import('../../config/firebase')
      const createTransfer = httpsCallable(functions, 'createUserTransfer')
      
      const result = await createTransfer({
        recipientEmail: data.recipientEmail.toLowerCase().trim(),
        amount: parseFloat(data.amount),
        note: data.note || ''
      })

      if (result.data.success) {
        toast.success('Transfer initiated successfully')
        setValue('recipientEmail', '')
        setValue('amount', '')
        setValue('note', '')
        setValue('confirmEmail', false)
        setLastTransferTime(new Date())
      } else {
        toast.error(result.data.error || 'Failed to create transfer')
      }
    } catch (error) {
      console.error('Transfer error:', error)
      toast.error(error.message || 'Error processing transfer')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <Send className="text-primary" size={32} />
        Transfer Funds
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-xl font-bold mb-6">Transfer Details</h2>

            <div className="mb-6 p-4 bg-dark-lighter rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400">Available Balance</span>
                <span className="text-2xl font-bold text-primary">{formatCurrency(availableBalance, 'INR')}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Recipient Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  {...register('recipientEmail', { 
                    required: 'Recipient email is required',
                    validate: (value) => validateEmail(value) || true
                  })}
                  className="input-field"
                  placeholder="Enter recipient email address"
                />
                {errors.recipientEmail && (
                  <p className="text-red-500 text-sm mt-1">{errors.recipientEmail.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('amount', { 
                    required: 'Amount is required',
                    min: { 
                      value: config.transferMinAmount || 100, 
                      message: `Minimum transfer is ${formatCurrency(config.transferMinAmount || 100, 'INR')}` 
                    },
                    max: { 
                      value: config.transferMaxAmount || 10000, 
                      message: `Maximum transfer is ${formatCurrency(config.transferMaxAmount || 10000, 'INR')}` 
                    }
                  })}
                  className="input-field"
                  placeholder="Enter amount"
                />
                {errors.amount && (
                  <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
                )}
                <p className="text-gray-400 text-xs mt-1">
                  Min: {formatCurrency(config.transferMinAmount || 100, 'INR')} | 
                  Max: {formatCurrency(config.transferMaxAmount || 10000, 'INR')}
                </p>
              </div>

              {config.enableTransferFee && amount && parseFloat(amount) > 0 && (
                <div className="p-4 bg-dark-lighter rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Transfer Amount:</span>
                    <span className="font-semibold">{formatCurrency(parseFloat(amount), 'INR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Fee ({config.transferFeeType === 'percent' ? `${config.transferFeeValue}%` : 'Flat'}):</span>
                    <span className="text-red-500">+{formatCurrency(feeAmount, 'INR')}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-700">
                    <span className="font-semibold">Total Deduction:</span>
                    <span className="font-bold text-primary">{formatCurrency(totalDeduction, 'INR')}</span>
                  </div>
                  {totalDeduction > availableBalance && (
                    <p className="text-red-500 text-sm mt-2">Insufficient balance</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Note (Optional)</label>
                <textarea
                  {...register('note')}
                  className="input-field min-h-[100px]"
                  placeholder="Add a note for this transfer..."
                />
              </div>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-yellow-500 mt-0.5" size={20} />
                  <div className="flex-1">
                    <p className="text-sm text-yellow-500 font-semibold mb-2">Important Warnings:</p>
                    <ul className="text-xs text-yellow-500/80 space-y-1 list-disc list-inside">
                      <li>Transfers cannot be reversed once completed</li>
                      <li>Double-check the recipient email address</li>
                      <li>Ensure you have sufficient balance including fees</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register('confirmEmail', { 
                    required: 'You must confirm the recipient email is correct'
                  })}
                  className="w-4 h-4"
                />
                <label className="text-sm">
                  I confirm the recipient email address is correct <span className="text-red-500">*</span>
                </label>
              </div>
              {errors.confirmEmail && (
                <p className="text-red-500 text-sm">{errors.confirmEmail.message}</p>
              )}

              <button
                type="submit"
                disabled={processing || totalDeduction > availableBalance || !confirmEmail}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    Send Transfer
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
              Transfer Information
            </h2>
            <div className="space-y-3 text-sm text-gray-400">
              <p>• Transfers are processed instantly</p>
              <p>• Recipient must be registered in the system</p>
              {config.transferCooldownMinutes && (
                <p>• Cooldown: {config.transferCooldownMinutes} minutes between transfers</p>
              )}
              {config.transferDailyLimit && (
                <p>• Daily limit: {config.transferDailyLimit} transfers</p>
              )}
              {config.enableTransferFee && (
                <p>• Transfer fee: {config.transferFeeType === 'percent' ? `${config.transferFeeValue}%` : formatCurrency(config.transferFeeValue, 'INR')}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

