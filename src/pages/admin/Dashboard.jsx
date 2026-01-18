import { useCollection } from '../../hooks/useFirestore'
import { Users, Package, DollarSign, TrendingUp } from 'lucide-react'

export default function AdminDashboard() {
  const { data: users } = useCollection('users', [])
  const { data: packages } = useCollection('packages', [])
  const { data: userPackages } = useCollection('userPackages', [])

  const activeUsers = users.filter(u => u.status === 'active').length
  const activePackages = userPackages.filter(p => p.status === 'active').length

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Users</p>
              <p className="text-2xl font-bold text-white">{users.length}</p>
            </div>
            <Users className="text-primary" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Active Users</p>
              <p className="text-2xl font-bold text-white">{activeUsers}</p>
            </div>
            <Users className="text-green-500" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Active Packages</p>
              <p className="text-2xl font-bold text-white">{activePackages}</p>
            </div>
            <Package className="text-primary" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Packages</p>
              <p className="text-2xl font-bold text-white">{packages.length}</p>
            </div>
            <TrendingUp className="text-primary" size={32} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/admin/users" className="btn-secondary text-center">Manage Users</a>
          <a href="/admin/packages" className="btn-secondary text-center">Manage Packages</a>
          <a href="/admin/content" className="btn-secondary text-center">Edit Content</a>
        </div>
      </div>
    </div>
  )
}

