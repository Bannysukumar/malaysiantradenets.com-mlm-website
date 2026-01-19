import { useAuth } from '../../contexts/AuthContext'
import { useCollection, useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { Package, Users, DollarSign, Wallet, AlertCircle, RefreshCw } from 'lucide-react'
import { formatCurrency } from '../../utils/helpers'
import { Link } from 'react-router-dom'

export default function UserDashboard() {
  const { user, userData } = useAuth()
  const { data: userPackages } = useCollection('userPackages', [])
  const userId = user?.uid || userData?.uid

  // Get active packages for this user, prioritizing Investor plans over Leader Program
  const activePackages = userPackages.filter(pkg => pkg.status === 'active' && pkg.userId === userId)
  
  // Find Investor plan first (not Leader Program)
  let activePackage = activePackages.find(pkg => 
    pkg.packageId !== 'LEADER_PROGRAM' && pkg.packageName !== 'Leader Program'
  )
  
  // If no Investor plan found, fall back to Leader Program
  if (!activePackage && activePackages.length > 0) {
    activePackage = activePackages[0]
  }
  
  // If multiple Investor plans, prefer the one with higher amount
  if (activePackage && activePackages.length > 1) {
    const investorPlans = activePackages.filter(pkg => 
      pkg.packageId !== 'LEADER_PROGRAM' && pkg.packageName !== 'Leader Program'
    )
    if (investorPlans.length > 1) {
      activePackage = investorPlans.reduce((prev, current) => {
        const prevAmount = prev.amount || prev.inrPrice || 0
        const currentAmount = current.amount || current.inrPrice || 0
        return currentAmount > prevAmount ? current : prev
      })
    }
  }
  const directReferrals = userData?.directReferrals || 0

  // Get wallet data from wallets collection
  const walletRef = userId ? doc(db, 'wallets', userId) : null
  const { data: walletData } = useFirestore(walletRef)
  
  // Use wallet data if available, fallback to userData for backward compatibility
  const walletBalance = walletData?.availableBalance ?? userData?.walletBalance ?? 0
  const totalIncome = walletData?.lifetimeEarned ?? userData?.totalIncome ?? 0

  // Get cap data
  const cycleNumber = activePackage?.cycleNumber || 1
  const capRef = userId ? doc(db, 'earningCaps', `${userId}_${cycleNumber}`) : null
  const { data: capData } = useFirestore(capRef)
  
  const earningsTotal = capData?.eligibleEarningsTotalInr || 0
  const capAmount = activePackage?.capAmountInr || capData?.capAmountInr || 0
  const remaining = Math.max(0, capAmount - earningsTotal)
  const progressPercent = capAmount > 0 ? Math.min(100, (earningsTotal / capAmount) * 100) : 0
  const capStatus = activePackage?.capStatus || capData?.capStatus || 'ACTIVE'

  // Calculate activation deadline
  const createdAt = userData?.createdAt?.toDate?.() || new Date()
  const activationWindow = 7 // Default 7 days, can be from config
  const deadline = new Date(createdAt)
  deadline.setDate(deadline.getDate() + activationWindow)
  const daysRemaining = Math.max(0, Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)))
  const isPendingActivation = userData?.status === 'PENDING_ACTIVATION'
  const isBlocked = userData?.status === 'AUTO_BLOCKED' || userData?.status === 'blocked'

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      
      {/* Activation Deadline Alert */}
      {isPendingActivation && !activePackage && (
        <div className="card border-yellow-500 border-2 mb-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={24} />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-yellow-500 mb-2">Activation Required</h2>
              <p className="text-gray-300 mb-2">
                You must activate a plan within <span className="font-bold text-white">{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span> to avoid account blocking.
              </p>
              <Link to="/app/choose-program" className="btn-primary inline-block">
                Choose Program & Activate
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Blocked Status Alert */}
      {isBlocked && (
        <div className="card border-red-500 border-2 mb-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={24} />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-red-500 mb-2">Account Blocked</h2>
              <p className="text-gray-300 mb-2">
                {userData?.autoBlockReason || 'Your account has been blocked. Please contact support for assistance.'}
              </p>
              <Link to="/app/support" className="btn-primary inline-block">
                Contact Support
              </Link>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Active Package</p>
              <p className="text-2xl font-bold text-white">
                {activePackage ? activePackage.packageName : 'None'}
              </p>
            </div>
            <Package className="text-primary" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Direct Referrals</p>
              <p className="text-2xl font-bold text-white">{directReferrals}</p>
            </div>
            <Users className="text-primary" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Wallet Balance</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(walletBalance, 'INR')}
              </p>
            </div>
            <Wallet className="text-primary" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Income</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(totalIncome, 'INR')}
              </p>
            </div>
            <DollarSign className="text-primary" size={32} />
          </div>
        </div>
      </div>

      {/* Cap Progress Banner */}
      {activePackage && (
        <div className={`card mb-8 ${
          capStatus === 'CAP_REACHED' ? 'border-red-500 border-2' :
          capStatus === 'RENEWAL_PENDING' ? 'border-yellow-500 border-2' :
          'border-gray-700'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {capStatus === 'CAP_REACHED' && <AlertCircle className="text-red-500" size={24} />}
              {capStatus === 'RENEWAL_PENDING' && <RefreshCw className="text-yellow-500" size={24} />}
              <h2 className="text-xl font-bold">
                Earnings Progress - Cycle {cycleNumber}
                {capStatus === 'CAP_REACHED' && (
                  <span className="ml-2 badge bg-red-500">Cap Reached</span>
                )}
                {capStatus === 'RENEWAL_PENDING' && (
                  <span className="ml-2 badge bg-yellow-500">Renewal Pending</span>
                )}
                {capStatus === 'ACTIVE' && (
                  <span className="ml-2 badge bg-green-500">Active</span>
                )}
              </h2>
            </div>
            {capStatus === 'CAP_REACHED' && (
              <Link to="/app/renewal" className="btn-primary">
                Renew ID Now
              </Link>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Earned: {formatCurrency(earningsTotal, 'INR')}</span>
              <span className="text-gray-400">Cap: {formatCurrency(capAmount, 'INR')}</span>
              <span className="text-gray-400">Remaining: {formatCurrency(remaining, 'INR')}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  capStatus === 'CAP_REACHED' ? 'bg-red-500' :
                  progressPercent > 80 ? 'bg-yellow-500' :
                  'bg-primary'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-xs text-gray-400">
              {progressPercent.toFixed(1)}% of cap reached
              {capStatus === 'CAP_REACHED' && (
                <span className="block text-red-400 mt-1">
                  You've reached the 3× cap. Renew your ID to continue earning.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link to="/app/packages" className="block btn-primary text-center">
              Browse Packages
            </Link>
            <Link to="/app/referrals" className="block btn-secondary text-center">
              View Referrals
            </Link>
            <Link to="/app/profile" className="block btn-secondary text-center">
              Update Profile
            </Link>
            {activePackage && capStatus === 'CAP_REACHED' && (
              <Link to="/app/renewal" className="block btn-primary text-center bg-red-500 hover:bg-red-600">
                Renew ID
              </Link>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
          <div className="text-gray-400 text-sm">
            {activePackage ? (
              <div>
                <p>Your package "{activePackage.packageName}" is active.</p>
                {capStatus === 'CAP_REACHED' && (
                  <p className="text-red-400 mt-2">
                    ⚠️ Cap reached. Please renew your ID to continue earning.
                  </p>
                )}
              </div>
            ) : (
              <p>No active packages. <Link to="/app/packages" className="text-primary hover:underline">Browse packages</Link> to get started.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

