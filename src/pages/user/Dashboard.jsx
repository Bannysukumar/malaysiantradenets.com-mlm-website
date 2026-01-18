import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import { Package, Users, DollarSign, Wallet } from 'lucide-react'
import { formatCurrency } from '../../utils/helpers'
import { Link } from 'react-router-dom'

export default function UserDashboard() {
  const { userData } = useAuth()
  const { data: userPackages } = useCollection('userPackages', [])

  const activePackage = userPackages.find(pkg => pkg.status === 'active' && pkg.userId === userData?.uid)
  const directReferrals = userData?.directReferrals || 0

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      
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
                {formatCurrency(userData?.walletBalance || 0, 'USD')}
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
                {formatCurrency(userData?.totalIncome || 0, 'USD')}
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
            <Link to="/app/packages" className="block btn-primary text-center">
              Browse Packages
            </Link>
            <Link to="/app/referrals" className="block btn-secondary text-center">
              View Referrals
            </Link>
            <Link to="/app/profile" className="block btn-secondary text-center">
              Update Profile
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
          <div className="text-gray-400 text-sm">
            {activePackage ? (
              <p>Your package "{activePackage.packageName}" is active.</p>
            ) : (
              <p>No active packages. <Link to="/app/packages" className="text-primary hover:underline">Browse packages</Link> to get started.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

