import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useFirestore } from '../../hooks/useFirestore'
import { doc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Send, AlertCircle, Wallet, DollarSign, Mail, Info, CheckCircle } from 'lucide-react'
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent flex items-center gap-3">
            <Send className="text-primary" size={36} />
            Transfer Funds
          </h1>
          <p className="text-gray-400">Send funds to other members</p>
        </div>
        <div className="card">
          <div className="text-center py-16">
            <div className="p-4 bg-primary/10 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <AlertCircle className="text-primary" size={48} />
            </div>
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent flex items-center gap-3">
          <Send className="text-primary" size={36} />
          Transfer Funds
        </h1>
        <p className="text-gray-400">Send funds to other members instantly</p>
      </div>

      {/* Available Balance Card */}
      <div className="card bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm mb-2 font-medium">Available Balance</p>
            <p className="text-4xl font-bold text-white mb-1">
              {formatCurrency(availableBalance, 'INR')}
            </p>
            <p className="text-sm text-gray-500">Ready to transfer</p>
          </div>
          <div className="p-4 bg-primary/20 rounded-xl">
            <Wallet className="text-primary" size={40} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transfer Form */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Send className="text-primary" size={24} />
              Transfer Details
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Recipient Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="email"
                    {...register('recipientEmail', { 
                      required: 'Recipient email is required',
                      validate: (value) => validateEmail(value) || true
                    })}
                    className="input-field pl-11"
                    placeholder="Enter recipient email address"
                  />
                </div>
                {errors.recipientEmail && (
                  <p className="text-red-500 text-sm mt-1">{errors.recipientEmail.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
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
                    className="input-field pl-11"
                    placeholder="Enter amount"
                  />
                </div>
                {errors.amount && (
                  <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
                )}
                <p className="text-gray-400 text-xs mt-2">
                  Min: {formatCurrency(config.transferMinAmount || 100, 'INR')} | 
                  Max: {formatCurrency(config.transferMaxAmount || 10000, 'INR')}
                </p>
              </div>

              {config.enableTransferFee && amount && parseFloat(amount) > 0 && (
                <div className="p-6 bg-dark-lighter rounded-lg space-y-3 border border-gray-700">
                  <h3 className="font-semibold text-white mb-4">Transfer Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Transfer Amount:</span>
                      <span className="font-semibold text-white">{formatCurrency(parseFloat(amount), 'INR')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Fee ({config.transferFeeType === 'percent' ? `${config.transferFeeValue}%` : 'Flat'}):</span>
                      <span className="text-red-400 font-semibold">+{formatCurrency(feeAmount, 'INR')}</span>
                    </div>
                    <div className="pt-3 border-t border-gray-700 flex justify-between items-center">
                      <span className="font-semibold text-white">Total Deduction:</span>
                      <span className="font-bold text-primary text-lg">{formatCurrency(totalDeduction, 'INR')}</span>
                    </div>
                    {totalDeduction > availableBalance && (
                      <p className="text-red-500 text-sm mt-2">⚠️ Insufficient balance</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2 text-white">Note (Optional)</label>
                <textarea
                  {...register('note')}
                  className="input-field min-h-[100px]"
                  placeholder="Add a note for this transfer..."
                />
              </div>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
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

              <div className="p-4 bg-dark-lighter rounded-lg">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    {...register('confirmEmail', { 
                      required: 'You must confirm the recipient email is correct'
                    })}
                    className="w-5 h-5 mt-0.5"
                  />
                  <label className="text-sm text-white">
                    I confirm the recipient email address is correct <span className="text-red-500">*</span>
                  </label>
                </div>
                {errors.confirmEmail && (
                  <p className="text-red-500 text-sm mt-2 ml-8">{errors.confirmEmail.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={processing || totalDeduction > availableBalance || !confirmEmail}
                className="w-full btn-primary py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
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

        {/* Information Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Info className="text-primary" size={24} />
              Transfer Information
            </h2>
            <div className="space-y-4">
              <div className="p-3 bg-dark-lighter rounded-lg">
                <p className="text-white font-medium mb-1">Processing</p>
                <p className="text-gray-400 text-sm">Transfers are processed instantly</p>
              </div>
              <div className="p-3 bg-dark-lighter rounded-lg">
                <p className="text-white font-medium mb-1">Recipient</p>
                <p className="text-gray-400 text-sm">Recipient must be registered in the system</p>
              </div>
              {config.transferCooldownMinutes && (
                <div className="p-3 bg-dark-lighter rounded-lg">
                  <p className="text-white font-medium mb-1">Cooldown</p>
                  <p className="text-gray-400 text-sm">{config.transferCooldownMinutes} minutes between transfers</p>
                </div>
              )}
              {config.transferDailyLimit && (
                <div className="p-3 bg-dark-lighter rounded-lg">
                  <p className="text-white font-medium mb-1">Daily Limit</p>
                  <p className="text-gray-400 text-sm">{config.transferDailyLimit} transfers per day</p>
                </div>
              )}
              {config.enableTransferFee && (
                <div className="p-3 bg-dark-lighter rounded-lg">
                  <p className="text-white font-medium mb-1">Transfer Fee</p>
                  <p className="text-gray-400 text-sm">
                    {config.transferFeeType === 'percent' 
                      ? `${config.transferFeeValue}%` 
                      : formatCurrency(config.transferFeeValue, 'INR')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="card bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
            <h3 className="font-semibold text-white mb-2">Need Help?</h3>
            <p className="text-gray-400 text-sm mb-3">
              If you have questions about transfers, contact our support team.
            </p>
            <a href="/app/support" className="text-primary hover:underline text-sm font-medium">
              Contact Support →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
