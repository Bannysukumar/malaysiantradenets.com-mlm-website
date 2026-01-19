import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection, useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { getFunctions, httpsCallable } from 'firebase/functions'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { RefreshCw, AlertCircle, Package, Wallet, CreditCard, CheckCircle } from 'lucide-react'
import { formatCurrency } from '../../utils/helpers'
import { Link } from 'react-router-dom'

export default function UserRenewal() {
  const { user, userData } = useAuth()
  const userId = user?.uid || userData?.uid
  const [processing, setProcessing] = useState(false)
  const [renewalConfig, setRenewalConfig] = useState(null)

  const { data: userPackages } = useCollection('userPackages', [])
  const { data: packages } = useCollection('packages', [])
  const { data: renewalConfigData } = useFirestore(doc(db, 'adminConfig', 'renewals'))
  const { data: walletData } = useFirestore(userId ? doc(db, 'wallets', userId) : null)

  const activePackage = userPackages.find(pkg => pkg.status === 'active' && pkg.userId === userId)
  const cycleNumber = activePackage?.cycleNumber || 1
  const capRef = userId ? doc(db, 'earningCaps', `${userId}_${cycleNumber}`) : null
  const { data: capData } = useFirestore(capRef)

  useEffect(() => {
    if (renewalConfigData) {
      setRenewalConfig(renewalConfigData)
    }
  }, [renewalConfigData])

  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      renewalPlanId: activePackage?.packageId || '',
      renewalMethod: 'user_wallet',
      confirmRenewal: false
    }
  })

  const renewalPlanId = watch('renewalPlanId')
  const renewalMethod = watch('renewalMethod')
  const confirmRenewal = watch('confirmRenewal')

  const selectedPlan = packages.find(p => p.id === renewalPlanId) || activePackage
  const renewalAmount = selectedPlan?.inrPrice || selectedPlan?.amount || 0
  const walletBalance = walletData?.availableBalance || userData?.walletBalance || 0
  const canPayFromWallet = renewalMethod === 'user_wallet' && walletBalance >= renewalAmount

  const earningsTotal = capData?.eligibleEarningsTotalInr || 0
  const capAmount = activePackage?.capAmountInr || capData?.capAmountInr || 0
  const capStatus = activePackage?.capStatus || 'ACTIVE'

  // Check if renewal is needed
  if (!activePackage) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <Package className="text-gray-400 mx-auto mb-4" size={48} />
          <p className="text-gray-400 text-lg mb-2">No active package found</p>
          <Link to="/app/packages" className="btn-primary">
            Browse Packages
          </Link>
        </div>
      </div>
    )
  }

  if (capStatus !== 'CAP_REACHED' && capStatus !== 'RENEWAL_PENDING') {
    return (
      <div className="card">
        <div className="text-center py-12">
          <CheckCircle className="text-green-500 mx-auto mb-4" size={48} />
          <p className="text-gray-400 text-lg mb-2">Your ID is active</p>
          <p className="text-gray-500 text-sm mb-4">
            You have not reached the cap yet. Current progress: {formatCurrency(earningsTotal, 'INR')} / {formatCurrency(capAmount, 'INR')}
          </p>
          <Link to="/app/dashboard" className="btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const onSubmit = async (data) => {
    if (!confirmRenewal) {
      toast.error('Please confirm that you want to proceed with renewal')
      return
    }

    setProcessing(true)
    try {
      const functions = getFunctions()
      const processRenewal = httpsCallable(functions, 'processRenewal')

      const result = await processRenewal({
        targetUid: userId,
        renewalPlanId: data.renewalPlanId || activePackage.packageId,
        renewalMethod: data.renewalMethod,
        notes: `User requested renewal via ${data.renewalMethod}`
      })

      if (result.data.success) {
        toast.success('Renewal request submitted successfully!')
        setTimeout(() => {
          window.location.href = '/app/dashboard'
        }, 2000)
      }
    } catch (error) {
      console.error('Renewal error:', error)
      toast.error(error.message || 'Error processing renewal request')
    } finally {
      setProcessing(false)
    }
  }

  const allowedMethods = renewalConfig?.renewalOptions || {}
  const availableMethods = []

  if (allowedMethods.userCanRequestRenewal) {
    availableMethods.push({ value: 'user_wallet', label: 'Pay from Wallet', icon: Wallet })
  }
  if (allowedMethods.paymentGatewayRenewal) {
    availableMethods.push({ value: 'gateway_payment', label: 'Pay via Gateway', icon: CreditCard })
  }
  if (allowedMethods.sponsorCanRenew) {
    availableMethods.push({ value: 'sponsor_wallet', label: 'Sponsor Pays', icon: Wallet })
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <RefreshCw className="text-primary" size={32} />
        Renew ID
      </h1>

      {/* Cap Status Alert */}
      <div className="card border-red-500 border-2 mb-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="text-red-500 flex-shrink-0" size={24} />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-red-500 mb-2">Cap Reached</h2>
            <p className="text-gray-300 mb-4">
              You have reached the 3× earnings cap (Cycle {cycleNumber}). 
              Renew your ID to continue earning and withdrawing.
            </p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Earned:</span>
                <p className="font-bold">{formatCurrency(earningsTotal, 'INR')}</p>
              </div>
              <div>
                <span className="text-gray-400">Cap Amount:</span>
                <p className="font-bold">{formatCurrency(capAmount, 'INR')}</p>
              </div>
              <div>
                <span className="text-gray-400">Base Amount:</span>
                <p className="font-bold">{formatCurrency(activePackage.baseAmountInr || activePackage.amount, 'INR')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Package className="text-primary" size={24} />
            Renewal Plan
          </h2>
          
          {renewalConfig?.allowRenewSamePlan && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Select Plan</label>
              <select
                {...register('renewalPlanId')}
                className="input-field"
              >
                <option value={activePackage.packageId}>
                  {activePackage.packageName} - {formatCurrency(activePackage.amount, 'INR')} (Same Plan)
                </option>
                {renewalConfig?.allowRenewUpgrade && packages
                  .filter(p => (p.inrPrice || p.usdPrice || 0) > activePackage.amount)
                  .map(pkg => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} - {formatCurrency(pkg.inrPrice || pkg.usdPrice || 0, 'INR')} (Upgrade)
                    </option>
                  ))
                }
              </select>
            </div>
          )}

          <div className="bg-dark-lighter p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Renewal Amount:</span>
              <span className="text-xl font-bold">{formatCurrency(renewalAmount, 'INR')}</span>
            </div>
            {renewalConfig?.renewalFeePercent > 0 && (
              <div className="flex justify-between items-center text-sm text-gray-400">
                <span>Fee ({renewalConfig.renewalFeePercent}%):</span>
                <span>{formatCurrency((renewalAmount * renewalConfig.renewalFeePercent) / 100, 'INR')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <CreditCard className="text-primary" size={24} />
            Payment Method
          </h2>
          
          {availableMethods.length === 0 ? (
            <div className="bg-yellow-500 bg-opacity-20 border border-yellow-500 rounded-lg p-4">
              <p className="text-yellow-500">
                No renewal methods available. Please contact admin for renewal.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableMethods.map(method => {
                const Icon = method.icon
                const isSelected = renewalMethod === method.value
                const insufficientBalance = method.value === 'user_wallet' && walletBalance < renewalAmount
                
                return (
                  <label
                    key={method.value}
                    className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary bg-opacity-10'
                        : 'border-gray-700 hover:border-gray-600'
                    } ${insufficientBalance ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        value={method.value}
                        {...register('renewalMethod')}
                        className="w-4 h-4"
                        disabled={insufficientBalance}
                      />
                      <Icon size={20} />
                      <div className="flex-1">
                        <div className="font-semibold">{method.label}</div>
                        {method.value === 'user_wallet' && (
                          <div className="text-sm text-gray-400">
                            Wallet Balance: {formatCurrency(walletBalance, 'INR')}
                            {insufficientBalance && (
                              <span className="text-red-500 ml-2">(Insufficient)</span>
                            )}
                          </div>
                        )}
                        {method.value === 'gateway_payment' && (
                          <div className="text-sm text-gray-400">Pay via Razorpay</div>
                        )}
                        {method.value === 'sponsor_wallet' && (
                          <div className="text-sm text-gray-400">Your sponsor will pay</div>
                        )}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">Renewal Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Current Cycle:</span>
              <span className="font-semibold">Cycle {cycleNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">New Cycle:</span>
              <span className="font-semibold">Cycle {cycleNumber + 1}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Plan:</span>
              <span className="font-semibold">{selectedPlan?.name || activePackage.packageName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Amount:</span>
              <span className="font-semibold">{formatCurrency(renewalAmount, 'INR')}</span>
            </div>
            {renewalMethod === 'user_wallet' && (
              <div className="flex justify-between">
                <span className="text-gray-400">Balance After:</span>
                <span className="font-semibold">{formatCurrency(walletBalance - renewalAmount, 'INR')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register('confirmRenewal')}
              className="w-4 h-4"
            />
            <span className="text-sm">
              I confirm that I want to renew my ID and start a new earning cycle. 
              This action will reset my earnings counter and allow me to continue earning.
            </span>
          </label>
        </div>

        <div className="flex gap-4">
          <Link to="/app/dashboard" className="btn-secondary flex-1 text-center">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={processing || !confirmRenewal || (renewalMethod === 'user_wallet' && !canPayFromWallet)}
            className="btn-primary flex-1"
          >
            {processing ? 'Processing...' : 'Submit Renewal Request'}
          </button>
        </div>
      </form>
    </div>
  )
}

