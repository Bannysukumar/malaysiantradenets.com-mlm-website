import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useFirestore } from '../../hooks/useFirestore'
import { doc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Wallet, DollarSign, AlertCircle, Info, ArrowUpCircle, CreditCard, Smartphone, CheckCircle } from 'lucide-react'
import { formatCurrency } from '../../utils/helpers'
import { validateWithdrawalAmount } from '../../utils/validation'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../config/firebase'

export default function UserWithdraw() {
  const { user, userData } = useAuth()
  const userId = user?.uid
  const { data: withdrawalConfig } = useFirestore(doc(db, 'adminConfig', 'withdrawals'))
  const financialProfileRef = userId ? doc(db, 'userFinancialProfiles', userId) : null
  const { data: financialProfile } = useFirestore(financialProfileRef)
  const [primaryBank, setPrimaryBank] = useState(null)
  const [primaryUPI, setPrimaryUPI] = useState(null)
  
  // Get wallet data from wallets collection
  const walletRef = userId ? doc(db, 'wallets', userId) : null
  const { data: walletData } = useFirestore(walletRef)
  
  // Use wallet data if available, fallback to userData for backward compatibility
  const availableBalance = walletData?.availableBalance ?? userData?.walletBalance ?? 0
  
  const [checking, setChecking] = useState(false)
  
  const config = withdrawalConfig || {
    minWithdrawal: 400,
    maxWithdrawal: 100000,
    feePercent: 10,
    allowedMethods: ['bank', 'upi'],
    requireKyc: false,
    requireBankVerified: true
  }

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm({
    defaultValues: {
      method: 'bank',
      amount: ''
    }
  })

  const amount = watch('amount')
  const method = watch('method')

  const feeAmount = amount ? (parseFloat(amount) * (config.feePercent || 10)) / 100 : 0
  const netAmount = amount ? parseFloat(amount) - feeAmount : 0

  // Load primary bank and UPI from banks subcollection
  useEffect(() => {
    const loadPrimaryPaymentMethods = async () => {
      if (!userId) return
      
      try {
        const banksRef = collection(db, 'userFinancialProfiles', userId, 'banks')
        const snapshot = await getDocs(banksRef)
        const banks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        
        // Find primary bank
        const primaryBankAccount = banks.find(b => b.paymentType === 'bank' && b.isPrimary) || 
                                   banks.find(b => b.paymentType === 'bank')
        if (primaryBankAccount) {
          setPrimaryBank(primaryBankAccount)
        }
        
        // Find primary UPI
        const primaryUPIAccount = banks.find(b => b.paymentType === 'upi' && b.isPrimary) || 
                                  banks.find(b => b.paymentType === 'upi')
        if (primaryUPIAccount) {
          setPrimaryUPI(primaryUPIAccount)
        }
      } catch (error) {
        console.error('Error loading payment methods:', error)
      }
    }
    
    loadPrimaryPaymentMethods()
  }, [userId])

  // Get verification status - prefer banks subcollection, fallback to legacy
  const bankVerified = primaryBank?.isVerified ?? financialProfile?.bank?.isVerified ?? false
  const bankDetails = primaryBank || financialProfile?.bank
  const upiDetails = primaryUPI || financialProfile?.upi

  const checkWithdrawalEligibility = async () => {
    if (!user || !userData) return

    setChecking(true)
    try {
      // Check if user has pending withdrawal requests
      const pendingQuery = query(
        collection(db, 'withdrawals'),
        where('uid', '==', user.uid),
        where('status', 'in', ['requested', 'under_review', 'approved'])
      )
      const pendingSnapshot = await getDocs(pendingQuery)
      
      if (!pendingSnapshot.empty) {
        toast.error('You have a pending withdrawal request. Please wait for it to be processed.')
        return false
      }

      // Check minimum balance
      if (availableBalance < config.minWithdrawal) {
        toast.error(`Minimum withdrawal amount is ${formatCurrency(config.minWithdrawal, 'INR')}`)
        return false
      }

      // Check KYC requirement
      if (config.requireKyc && !userData.kycVerified) {
        toast.error('KYC verification is required before withdrawal')
        return false
      }

      // Check bank verification requirement
      if (config.requireBankVerified && method === 'bank') {
        if (!bankVerified) {
          toast.error('Bank details must be verified before withdrawal')
          return false
        }
      }

      // Check UPI requirement
      if (method === 'upi' && !upiDetails?.upiId) {
        toast.error('UPI ID is required for UPI withdrawal')
        return false
      }

      return true
    } catch (error) {
      console.error('Error checking eligibility:', error)
      toast.error('Error checking withdrawal eligibility')
      return false
    } finally {
      setChecking(false)
    }
  }

  const onSubmit = async (data) => {
    try {
      const amountNum = parseFloat(data.amount)
      
      // Validate amount
      const amountError = validateWithdrawalAmount(
        amountNum,
        config.minWithdrawal,
        config.maxWithdrawal
      )
      if (amountError) {
        toast.error(amountError)
        return
      }

      // Check eligibility
      const eligible = await checkWithdrawalEligibility()
      if (!eligible) return

      // Check available balance
      if (amountNum > availableBalance) {
        toast.error('Insufficient balance')
        return
      }

      // Create withdrawal request via Cloud Function (server-side validation)
      const { httpsCallable } = await import('firebase/functions')
      const { functions } = await import('../../config/firebase')
      const createWithdrawalRequest = httpsCallable(functions, 'createWithdrawalRequest')
      const result = await createWithdrawalRequest({
        amount: amountNum,
        method: data.method,
        payoutDetails: data.method === 'bank' ? {
          accountNumber: bankDetails?.accountNumberMasked || (bankDetails?.accountNumberLast4 ? `XXXXXX${bankDetails.accountNumberLast4}` : ''),
          ifsc: bankDetails?.ifsc || '',
          holderName: bankDetails?.holderName || ''
        } : {
          upiId: upiDetails?.upiId || ''
        }
      })

      if (result.data.success) {
        toast.success('Withdrawal request submitted successfully')
        setValue('amount', '')
      } else {
        toast.error(result.data.error || 'Failed to create withdrawal request')
      }
    } catch (error) {
      console.error('Withdrawal error:', error)
      toast.error(error.message || 'Error submitting withdrawal request')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent flex items-center gap-3">
          <ArrowUpCircle className="text-primary" size={36} />
          Request Withdrawal
        </h1>
        <p className="text-gray-400">Withdraw your earnings to your bank account or UPI</p>
      </div>

      {/* Available Balance Card */}
      <div className="card bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm mb-2 font-medium">Available Balance</p>
            <p className="text-4xl font-bold text-white mb-1">
              {formatCurrency(availableBalance, 'INR')}
            </p>
            <p className="text-sm text-gray-500">Ready to withdraw</p>
          </div>
          <div className="p-4 bg-primary/20 rounded-xl">
            <Wallet className="text-primary" size={40} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Withdrawal Form */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <DollarSign className="text-primary" size={24} />
              Withdrawal Details
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Withdrawal Method <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {config.allowedMethods?.includes('bank') && (
                    <label className={`relative cursor-pointer ${method === 'bank' ? 'ring-2 ring-primary' : ''}`}>
                      <input
                        type="radio"
                        value="bank"
                        {...register('method', { required: 'Please select withdrawal method' })}
                        className="sr-only"
                      />
                      <div className={`p-4 rounded-lg border-2 transition-all ${
                        method === 'bank' 
                          ? 'border-primary bg-primary/10' 
                          : 'border-gray-700 hover:border-gray-600'
                      }`}>
                        <div className="flex items-center gap-3">
                          <CreditCard className={method === 'bank' ? 'text-primary' : 'text-gray-400'} size={24} />
                          <div>
                            <p className="font-semibold text-white">Bank Transfer</p>
                            <p className="text-xs text-gray-400">Direct to account</p>
                          </div>
                        </div>
                      </div>
                    </label>
                  )}
                  {config.allowedMethods?.includes('upi') && (
                    <label className={`relative cursor-pointer ${method === 'upi' ? 'ring-2 ring-primary' : ''}`}>
                      <input
                        type="radio"
                        value="upi"
                        {...register('method', { required: 'Please select withdrawal method' })}
                        className="sr-only"
                      />
                      <div className={`p-4 rounded-lg border-2 transition-all ${
                        method === 'upi' 
                          ? 'border-primary bg-primary/10' 
                          : 'border-gray-700 hover:border-gray-600'
                      }`}>
                        <div className="flex items-center gap-3">
                          <Smartphone className={method === 'upi' ? 'text-primary' : 'text-gray-400'} size={24} />
                          <div>
                            <p className="font-semibold text-white">UPI</p>
                            <p className="text-xs text-gray-400">Instant transfer</p>
                          </div>
                        </div>
                      </div>
                    </label>
                  )}
                </div>
                {errors.method && (
                  <p className="text-red-500 text-sm mt-1">{errors.method.message}</p>
                )}
              </div>

              {method === 'bank' && (
                <div className={`p-4 rounded-lg border-2 ${
                  bankVerified 
                    ? 'border-green-500/50 bg-green-500/10' 
                    : 'border-yellow-500/50 bg-yellow-500/10'
                }`}>
                  <div className="flex items-start gap-3 mb-3">
                    {bankVerified ? (
                      <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
                    ) : (
                      <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-white">Bank Details</h3>
                        {bankVerified ? (
                          <span className="badge bg-green-500 text-xs">Verified</span>
                        ) : (
                          <span className="badge bg-yellow-500 text-xs">Pending Verification</span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm">
                        <p className="text-gray-300">
                          <span className="text-gray-400">Account:</span> {bankDetails?.accountNumberMasked || bankDetails?.accountNumberLast4 ? `XXXXXX${bankDetails?.accountNumberLast4 || ''}` : 'Not set'}
                        </p>
                        <p className="text-gray-300">
                          <span className="text-gray-400">IFSC:</span> {bankDetails?.ifsc || 'Not set'}
                        </p>
                        <p className="text-gray-300">
                          <span className="text-gray-400">Holder:</span> {bankDetails?.holderName || 'Not set'}
                        </p>
                        {bankDetails?.bankName && (
                          <p className="text-gray-300">
                            <span className="text-gray-400">Bank:</span> {bankDetails.bankName}
                          </p>
                        )}
                      </div>
                      {!bankVerified && (
                        <p className="text-yellow-500 text-sm mt-3">
                          ⚠️ Bank details submitted for verification. Please wait for admin approval.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {method === 'upi' && (
                <div className={`p-4 rounded-lg border-2 ${
                  upiDetails?.upiId 
                    ? upiDetails?.isVerified
                      ? 'border-green-500/50 bg-green-500/10'
                      : 'border-yellow-500/50 bg-yellow-500/10'
                    : 'border-red-500/50 bg-red-500/10'
                }`}>
                  <div className="flex items-start gap-3">
                    {upiDetails?.upiId ? (
                      upiDetails?.isVerified ? (
                        <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
                      ) : (
                        <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
                      )
                    ) : (
                      <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-white">UPI Details</h3>
                        {upiDetails?.isVerified ? (
                          <span className="badge bg-green-500 text-xs">Verified</span>
                        ) : upiDetails?.upiId ? (
                          <span className="badge bg-yellow-500 text-xs">Pending Verification</span>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-300">
                        <span className="text-gray-400">UPI ID:</span> {upiDetails?.upiId || 'Not set'}
                      </p>
                      {upiDetails?.upiId && !upiDetails?.isVerified && (
                        <p className="text-yellow-500 text-sm mt-3">
                          ⚠️ UPI ID submitted for verification. Please wait for admin approval.
                        </p>
                      )}
                      {!upiDetails?.upiId && (
                        <p className="text-yellow-500 text-sm mt-3">
                          ⚠️ UPI ID not set. Please update in Profile.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Withdrawal Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('amount', { 
                    required: 'Amount is required',
                    min: { value: config.minWithdrawal, message: `Minimum withdrawal is ${formatCurrency(config.minWithdrawal, 'INR')}` },
                    max: { value: config.maxWithdrawal || 1000000, message: `Maximum withdrawal is ${formatCurrency(config.maxWithdrawal || 1000000, 'INR')}` }
                  })}
                  className="input-field text-lg"
                  placeholder="Enter amount"
                />
                {errors.amount && (
                  <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
                )}
                <p className="text-gray-400 text-xs mt-2">
                  Min: {formatCurrency(config.minWithdrawal, 'INR')} | Max: {formatCurrency(config.maxWithdrawal || 1000000, 'INR')}
                </p>
              </div>

              {amount && parseFloat(amount) > 0 && (
                <div className="p-6 bg-dark-lighter rounded-lg space-y-3 border border-gray-700">
                  <h3 className="font-semibold text-white mb-4">Withdrawal Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Withdrawal Amount:</span>
                      <span className="font-semibold text-white text-lg">{formatCurrency(parseFloat(amount), 'INR')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Admin Charges ({config.feePercent}%):</span>
                      <span className="text-red-400 font-semibold">-{formatCurrency(feeAmount, 'INR')}</span>
                    </div>
                    <div className="pt-3 border-t border-gray-700 flex justify-between items-center">
                      <span className="font-semibold text-white text-lg">Net Amount You'll Receive:</span>
                      <span className="font-bold text-primary text-xl">{formatCurrency(netAmount, 'INR')}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={checking}
                className="w-full btn-primary py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {checking ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <ArrowUpCircle size={20} />
                    Submit Withdrawal Request
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
              Important Notes
            </h2>
            <div className="space-y-4">
              <div className="p-3 bg-dark-lighter rounded-lg">
                <p className="text-white font-medium mb-1">Processing Schedule</p>
                <p className="text-gray-400 text-sm">Withdrawals are processed weekly (Monday release)</p>
                <p className="text-gray-400 text-sm">Cutoff time: Friday 5:00 PM</p>
              </div>
              <div className="p-3 bg-dark-lighter rounded-lg">
                <p className="text-white font-medium mb-1">Fees</p>
                <p className="text-gray-400 text-sm">Admin charges: {config.feePercent}%</p>
                <p className="text-gray-400 text-sm">Minimum: {formatCurrency(config.minWithdrawal, 'INR')}</p>
              </div>
              {config.requireKyc && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-yellow-500 text-sm font-medium">⚠️ KYC verification required</p>
                </div>
              )}
              {config.requireBankVerified && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-yellow-500 text-sm font-medium">⚠️ Bank details must be verified</p>
                </div>
              )}
            </div>
          </div>

          <div className="card bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
            <h3 className="font-semibold text-white mb-3">Need Help?</h3>
            <p className="text-gray-400 text-sm mb-3">
              If you have questions about withdrawals, contact our support team.
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

