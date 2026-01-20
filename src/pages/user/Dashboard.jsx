import { useAuth } from '../../contexts/AuthContext'
import { useCollection, useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { Package, Users, DollarSign, Wallet, AlertCircle, RefreshCw, TrendingUp, ArrowRight, Sparkles } from 'lucide-react'
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
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Welcome back, {userData?.name || 'Member'}!
          </h1>
          <p className="text-gray-400">Here's your account overview</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-sm text-gray-400">
          <Sparkles size={16} className="text-primary" />
          <span>Member Portal</span>
        </div>
      </div>
      
      {/* Activation Deadline Alert */}
      {isPendingActivation && !activePackage && (
        <div className="card border-2 border-yellow-500/50 bg-gradient-to-r from-yellow-500/10 to-transparent">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-yellow-500/20 rounded-lg flex-shrink-0">
              <AlertCircle className="text-yellow-500" size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-yellow-500 mb-2">Activation Required</h2>
              <p className="text-gray-300 mb-4">
                You must activate a plan within <span className="font-bold text-white text-lg">{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span> to avoid account blocking.
              </p>
              <Link to="/app/choose-program" className="inline-flex items-center gap-2 btn-primary">
                Choose Program & Activate
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Blocked Status Alert */}
      {isBlocked && (
        <div className="card border-2 border-red-500/50 bg-gradient-to-r from-red-500/10 to-transparent">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-500/20 rounded-lg flex-shrink-0">
              <AlertCircle className="text-red-500" size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-red-500 mb-2">Account Blocked</h2>
              <p className="text-gray-300 mb-4">
                {userData?.autoBlockReason || 'Your account has been blocked. Please contact support for assistance.'}
              </p>
              <Link to="/app/support" className="inline-flex items-center gap-2 btn-primary">
                Contact Support
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      )}
      
      {/* Stats Cards - Enhanced Design */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card hover:border-primary transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-gray-400 text-sm mb-2 font-medium">Active Package</p>
              <p className="text-2xl font-bold text-white mb-1">
                {activePackage ? activePackage.packageName : 'None'}
              </p>
              {activePackage && (
                <p className="text-xs text-gray-500">Cycle {cycleNumber}</p>
              )}
            </div>
            <div className="p-3 bg-primary/10 rounded-xl">
              <Package className="text-primary" size={28} />
            </div>
          </div>
        </div>

        <div className="card hover:border-primary transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-gray-400 text-sm mb-2 font-medium">Direct Referrals</p>
              <p className="text-2xl font-bold text-white">{directReferrals}</p>
              <Link to="/app/referrals" className="text-xs text-primary hover:underline mt-1 inline-block">
                View all →
              </Link>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl">
              <Users className="text-primary" size={28} />
            </div>
          </div>
        </div>

        <div className="card hover:border-primary transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-gray-400 text-sm mb-2 font-medium">Wallet Balance</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(walletBalance, 'INR')}
              </p>
              <Link to="/app/wallet" className="text-xs text-primary hover:underline mt-1 inline-block">
                View wallet →
              </Link>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl">
              <Wallet className="text-primary" size={28} />
            </div>
          </div>
        </div>

        <div className="card hover:border-primary transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-gray-400 text-sm mb-2 font-medium">Total Income</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(totalIncome, 'INR')}
              </p>
              <Link to="/app/income-history" className="text-xs text-primary hover:underline mt-1 inline-block">
                View history →
              </Link>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl">
              <DollarSign className="text-primary" size={28} />
            </div>
          </div>
        </div>
      </div>

      {/* Cap Progress Banner - Enhanced */}
      {activePackage && (
        <div className={`card ${
          capStatus === 'CAP_REACHED' ? 'border-2 border-red-500/50 bg-gradient-to-r from-red-500/10 to-transparent' :
          capStatus === 'RENEWAL_PENDING' ? 'border-2 border-yellow-500/50 bg-gradient-to-r from-yellow-500/10 to-transparent' :
          'border border-gray-700 bg-gradient-to-r from-primary/5 to-transparent'
        }`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${
                capStatus === 'CAP_REACHED' ? 'bg-red-500/20' :
                capStatus === 'RENEWAL_PENDING' ? 'bg-yellow-500/20' :
                'bg-primary/20'
              }`}>
                {capStatus === 'CAP_REACHED' && <AlertCircle className="text-red-500" size={24} />}
                {capStatus === 'RENEWAL_PENDING' && <RefreshCw className="text-yellow-500" size={24} />}
                {capStatus === 'ACTIVE' && <TrendingUp className="text-primary" size={24} />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Earnings Progress - Cycle {cycleNumber}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {capStatus === 'CAP_REACHED' && (
                    <span className="badge bg-red-500 text-white">Cap Reached</span>
                  )}
                  {capStatus === 'RENEWAL_PENDING' && (
                    <span className="badge bg-yellow-500 text-white">Renewal Pending</span>
                  )}
                  {capStatus === 'ACTIVE' && (
                    <span className="badge bg-green-500 text-white">Active</span>
                  )}
                </div>
              </div>
            </div>
            {capStatus === 'CAP_REACHED' && (
              <Link to="/app/renewal" className="btn-primary flex items-center gap-2">
                Renew ID Now
                <ArrowRight size={18} />
              </Link>
            )}
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center p-3 bg-dark-lighter rounded-lg">
                <p className="text-gray-400 mb-1">Earned</p>
                <p className="text-white font-bold text-lg">{formatCurrency(earningsTotal, 'INR')}</p>
              </div>
              <div className="text-center p-3 bg-dark-lighter rounded-lg">
                <p className="text-gray-400 mb-1">Cap Amount</p>
                <p className="text-white font-bold text-lg">{formatCurrency(capAmount, 'INR')}</p>
              </div>
              <div className="text-center p-3 bg-dark-lighter rounded-lg">
                <p className="text-gray-400 mb-1">Remaining</p>
                <p className="text-white font-bold text-lg">{formatCurrency(remaining, 'INR')}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Progress</span>
                <span className="text-gray-400 font-semibold">{progressPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    capStatus === 'CAP_REACHED' ? 'bg-gradient-to-r from-red-500 to-red-600' :
                    progressPercent > 80 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
                    'bg-gradient-to-r from-primary to-primary/80'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            
            {capStatus === 'CAP_REACHED' && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 text-sm">
                  ⚠️ You've reached the 3× cap. Renew your ID to continue earning.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Sparkles className="text-primary" size={20} />
            Quick Actions
          </h2>
          <div className="space-y-3">
            <Link to="/app/packages" className="flex items-center justify-between p-4 bg-dark-lighter rounded-lg hover:bg-primary/10 transition-colors group">
              <div className="flex items-center gap-3">
                <Package className="text-primary" size={20} />
                <span className="font-medium">Browse Packages</span>
              </div>
              <ArrowRight className="text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all" size={18} />
            </Link>
            <Link to="/app/referrals" className="flex items-center justify-between p-4 bg-dark-lighter rounded-lg hover:bg-primary/10 transition-colors group">
              <div className="flex items-center gap-3">
                <Users className="text-primary" size={20} />
                <span className="font-medium">View Referrals</span>
              </div>
              <ArrowRight className="text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all" size={18} />
            </Link>
            <Link to="/app/profile" className="flex items-center justify-between p-4 bg-dark-lighter rounded-lg hover:bg-primary/10 transition-colors group">
              <div className="flex items-center gap-3">
                <Wallet className="text-primary" size={20} />
                <span className="font-medium">Update Profile</span>
              </div>
              <ArrowRight className="text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all" size={18} />
            </Link>
            {activePackage && capStatus === 'CAP_REACHED' && (
              <Link to="/app/renewal" className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors group">
                <div className="flex items-center gap-3">
                  <RefreshCw className="text-red-500" size={20} />
                  <span className="font-medium text-red-400">Renew ID</span>
                </div>
                <ArrowRight className="text-red-400 group-hover:translate-x-1 transition-all" size={18} />
              </Link>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <TrendingUp className="text-primary" size={20} />
            Recent Activity
          </h2>
          <div className="space-y-4">
            {activePackage ? (
              <div className="p-4 bg-dark-lighter rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Package className="text-green-500" size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Package Active</p>
                    <p className="text-gray-400 text-sm mt-1">
                      Your package "{activePackage.packageName}" is currently active and earning.
                    </p>
                    {capStatus === 'CAP_REACHED' && (
                      <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-red-400 text-sm">
                          ⚠️ Cap reached. Please renew your ID to continue earning.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-dark-lighter rounded-lg text-center">
                <Package className="text-gray-500 mx-auto mb-2" size={32} />
                <p className="text-gray-400 mb-3">No active packages yet.</p>
                <Link to="/app/packages" className="text-primary hover:underline font-medium">
                  Browse packages to get started →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
