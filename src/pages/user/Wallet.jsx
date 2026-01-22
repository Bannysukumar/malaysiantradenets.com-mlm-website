import { useAuth } from '../../contexts/AuthContext'
import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { Wallet, IndianRupee, TrendingUp, Clock, ArrowUpCircle, History, Info, Sparkles } from 'lucide-react'
import { formatCurrency } from '../../utils/helpers'
import { Link } from 'react-router-dom'

export default function UserWallet() {
  const { user, userData } = useAuth()
  const userId = user?.uid || userData?.uid
  
  // Only create document reference if userId exists
  const walletRef = userId ? doc(db, 'wallets', userId) : null
  const { data: walletData } = useFirestore(walletRef)

  const wallet = walletData || {
    availableBalance: userData?.walletBalance || 0,
    pendingBalance: userData?.pendingBalance || 0,
    lifetimeEarned: userData?.lifetimeEarned || 0,
    lifetimeWithdrawn: userData?.lifetimeWithdrawn || 0,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
          My Wallet
        </h1>
        <p className="text-gray-400">Manage your earnings and withdrawals</p>
      </div>

      {/* Main Balance Card */}
      <div className="card bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-gray-400 text-sm mb-2 font-medium">Available Balance</p>
            <p className="text-4xl font-bold text-white mb-1">
              {formatCurrency(wallet.availableBalance || 0, 'INR')}
            </p>
            <p className="text-sm text-gray-500">Ready to withdraw</p>
          </div>
          <div className="p-4 bg-primary/20 rounded-xl">
            <Wallet className="text-primary" size={40} />
          </div>
        </div>
        <div className="flex gap-3">
          <Link to="/app/withdraw" className="flex-1 btn-primary flex items-center justify-center gap-2">
            <ArrowUpCircle size={18} />
            Withdraw Now
          </Link>
          <Link to="/app/income-history" className="flex-1 btn-secondary flex items-center justify-center gap-2">
            <History size={18} />
            View History
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card hover:border-primary transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-2 font-medium">Pending Balance</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(wallet.pendingBalance || 0, 'INR')}
              </p>
              <p className="text-xs text-gray-500 mt-1">Awaiting approval</p>
            </div>
            <div className="p-3 bg-yellow-500/10 rounded-xl">
              <Clock className="text-yellow-500" size={28} />
            </div>
          </div>
        </div>

        <div className="card hover:border-primary transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-2 font-medium">Total Earned</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(wallet.lifetimeEarned || 0, 'INR')}
              </p>
              <p className="text-xs text-gray-500 mt-1">Lifetime earnings</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-xl">
              <TrendingUp className="text-green-500" size={28} />
            </div>
          </div>
        </div>

        <div className="card hover:border-primary transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 transform hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-2 font-medium">Total Withdrawn</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(wallet.lifetimeWithdrawn || 0, 'INR')}
              </p>
              <p className="text-xs text-gray-500 mt-1">All time withdrawals</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <IndianRupee className="text-blue-500" size={28} />
            </div>
          </div>
        </div>
      </div>

      {/* Information Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Sparkles className="text-primary" size={20} />
            Quick Actions
          </h2>
          <div className="space-y-3">
            <Link 
              to="/app/withdraw" 
              className="flex items-center justify-between p-4 bg-dark-lighter rounded-lg hover:bg-primary/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <ArrowUpCircle className="text-primary" size={20} />
                <span className="font-medium">Request Withdrawal</span>
              </div>
              <span className="text-gray-400 group-hover:text-primary">→</span>
            </Link>
            <Link 
              to="/app/income-history" 
              className="flex items-center justify-between p-4 bg-dark-lighter rounded-lg hover:bg-primary/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <History className="text-primary" size={20} />
                <span className="font-medium">View Income History</span>
              </div>
              <span className="text-gray-400 group-hover:text-primary">→</span>
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Info className="text-primary" size={20} />
            Wallet Information
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-dark-lighter rounded-lg">
              <p className="text-white font-medium mb-2">Available Balance</p>
              <p className="text-gray-400 text-sm">
                This amount can be withdrawn immediately. Withdrawals are processed weekly on Mondays.
              </p>
            </div>
            <div className="p-4 bg-dark-lighter rounded-lg">
              <p className="text-white font-medium mb-2">Pending Balance</p>
              <p className="text-gray-400 text-sm">
                This amount is awaiting admin approval. It will be moved to available balance once approved.
              </p>
            </div>
            <div className="p-4 bg-dark-lighter rounded-lg">
              <p className="text-white font-medium mb-2">Withdrawal Schedule</p>
              <p className="text-gray-400 text-sm">
                Cutoff time: Friday 5:00 PM | Release: Monday
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
