import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useFirestore } from '../../hooks/useFirestore'
import { doc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Wallet, DollarSign, AlertCircle } from 'lucide-react'
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
      if ((userData.walletBalance || 0) < config.minWithdrawal) {
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
        if (!financialProfile?.bank?.isVerified) {
          toast.error('Bank details must be verified before withdrawal')
          return false
        }
      }

      // Check UPI requirement
      if (method === 'upi' && !financialProfile?.upi?.upiId) {
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
      if (amountNum > (userData.walletBalance || 0)) {
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
          accountNumber: financialProfile?.bank?.accountNumberMasked || '',
          ifsc: financialProfile?.bank?.ifsc || '',
          holderName: financialProfile?.bank?.holderName || ''
        } : {
          upiId: financialProfile?.upi?.upiId || ''
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
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <Wallet className="text-primary" size={32} />
        Request Withdrawal
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-xl font-bold mb-6">Withdrawal Details</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Available Balance
                </label>
                <div className="input-field bg-dark-lighter opacity-50 cursor-not-allowed">
                  {formatCurrency(userData?.walletBalance || 0, 'INR')}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Withdrawal Method <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('method', { required: 'Please select withdrawal method' })}
                  className="input-field"
                >
                  {config.allowedMethods?.includes('bank') && (
                    <option value="bank">Bank Transfer</option>
                  )}
                  {config.allowedMethods?.includes('upi') && (
                    <option value="upi">UPI</option>
                  )}
                </select>
                {errors.method && (
                  <p className="text-red-500 text-sm mt-1">{errors.method.message}</p>
                )}
              </div>

              {method === 'bank' && (
                <div className="p-4 bg-dark-lighter rounded-lg">
                  <h3 className="font-semibold mb-2">Bank Details</h3>
                  <p className="text-sm text-gray-400">
                    Account: {financialProfile?.bank?.accountNumberMasked || 'Not set'}
                  </p>
                  <p className="text-sm text-gray-400">
                    IFSC: {financialProfile?.bank?.ifsc || 'Not set'}
                  </p>
                  <p className="text-sm text-gray-400">
                    Holder: {financialProfile?.bank?.holderName || 'Not set'}
                  </p>
                  {!financialProfile?.bank?.isVerified && (
                    <p className="text-yellow-500 text-sm mt-2">
                      ⚠️ Bank details not verified. Please update in Profile.
                    </p>
                  )}
                </div>
              )}

              {method === 'upi' && (
                <div className="p-4 bg-dark-lighter rounded-lg">
                  <h3 className="font-semibold mb-2">UPI Details</h3>
                  <p className="text-sm text-gray-400">
                    UPI ID: {financialProfile?.upi?.upiId || 'Not set'}
                  </p>
                  {!financialProfile?.upi?.upiId && (
                    <p className="text-yellow-500 text-sm mt-2">
                      ⚠️ UPI ID not set. Please update in Profile.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
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
                  className="input-field"
                  placeholder="Enter amount"
                />
                {errors.amount && (
                  <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
                )}
                <p className="text-gray-400 text-xs mt-1">
                  Min: {formatCurrency(config.minWithdrawal, 'INR')} | 
                  Max: {formatCurrency(config.maxWithdrawal || 1000000, 'INR')}
                </p>
              </div>

              {amount && parseFloat(amount) > 0 && (
                <div className="p-4 bg-dark-lighter rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount:</span>
                    <span className="font-semibold">{formatCurrency(parseFloat(amount), 'INR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Admin Charges ({config.feePercent}%):</span>
                    <span className="text-red-500">-{formatCurrency(feeAmount, 'INR')}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-700">
                    <span className="font-semibold">Net Amount:</span>
                    <span className="font-bold text-primary">{formatCurrency(netAmount, 'INR')}</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={checking}
                className="w-full btn-primary"
              >
                {checking ? 'Processing...' : 'Submit Withdrawal Request'}
              </button>
            </form>
          </div>
        </div>

        <div>
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <AlertCircle className="text-primary" size={24} />
              Important Notes
            </h2>
            <div className="space-y-3 text-sm text-gray-400">
              <p>• Withdrawals are processed weekly (Monday release)</p>
              <p>• Cutoff time: Friday 5:00 PM</p>
              <p>• Admin charges: {config.feePercent}%</p>
              <p>• Minimum withdrawal: {formatCurrency(config.minWithdrawal, 'INR')}</p>
              {config.requireKyc && (
                <p className="text-yellow-500">• KYC verification required</p>
              )}
              {config.requireBankVerified && (
                <p className="text-yellow-500">• Bank details must be verified</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

