import { useAuth } from '../../contexts/AuthContext'
import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { Wallet, DollarSign, TrendingUp, Clock } from 'lucide-react'
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
    <div>
      <h1 className="text-3xl font-bold mb-8">Wallet</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Available Balance</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(wallet.availableBalance || 0, 'INR')}
              </p>
            </div>
            <Wallet className="text-primary" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Pending Balance</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(wallet.pendingBalance || 0, 'INR')}
              </p>
            </div>
            <Clock className="text-primary" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Earned</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(wallet.lifetimeEarned || 0, 'INR')}
              </p>
            </div>
            <TrendingUp className="text-primary" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Withdrawn</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(wallet.lifetimeWithdrawn || 0, 'INR')}
              </p>
            </div>
            <DollarSign className="text-primary" size={32} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link to="/app/withdraw" className="block btn-primary text-center">
              Request Withdrawal
            </Link>
            <Link to="/app/income-history" className="block btn-secondary text-center">
              View Income History
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">Wallet Information</h2>
          <div className="space-y-2 text-sm text-gray-400">
            <p>Available balance can be withdrawn immediately</p>
            <p>Pending balance is awaiting approval</p>
            <p>All withdrawals are processed weekly (Monday release)</p>
          </div>
        </div>
      </div>
    </div>
  )
}

