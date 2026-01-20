import { useCollection } from '../../hooks/useFirestore'
import { Users, Package, DollarSign, TrendingUp, UserX, UserCheck, Calendar } from 'lucide-react'
import { useMemo } from 'react'
import { formatCurrency } from '../../utils/helpers'

export default function AdminDashboard() {
  const { data: users } = useCollection('users', [])
  const { data: packages } = useCollection('packages', [])
  const { data: userPackages } = useCollection('userPackages', [])

  // Calculate metrics
  const metrics = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    // Total Investment (sum of all active packages)
    const totalInvest = userPackages
      .filter(p => p.status === 'active')
      .reduce((sum, p) => sum + (p.amount || p.inrPrice || 0), 0)

    // Today's Investment (packages activated today)
    const todayInvest = userPackages
      .filter(p => {
        if (p.status !== 'active') return false
        const activatedAt = p.activatedAt?.toDate?.() || p.createdAt?.toDate?.()
        if (!activatedAt) return false
        return activatedAt >= today && activatedAt <= todayEnd
      })
      .reduce((sum, p) => sum + (p.amount || p.inrPrice || 0), 0)

    // Inactive Users
    const inactiveUsers = users.filter(u => 
      u.status !== 'active' && 
      u.status !== 'ACTIVE_INVESTOR' && 
      u.status !== 'ACTIVE_LEADER'
    ).length

    // Total Leaders
    const totalLeaders = users.filter(u => 
      u.programType === 'leader' || 
      u.status === 'ACTIVE_LEADER'
    ).length

    // Total Investors
    const totalInvestors = users.filter(u => 
      u.programType === 'investor' || 
      u.status === 'ACTIVE_INVESTOR'
    ).length

    // Today's Investors (users who activated investor packages today)
    const todayInvestors = userPackages.filter(p => {
      if (p.status !== 'active') return false
      if (p.packageId === 'LEADER_PROGRAM' || p.packageName === 'Leader Program') return false
      const activatedAt = p.activatedAt?.toDate?.() || p.createdAt?.toDate?.()
      if (!activatedAt) return false
      return activatedAt >= today && activatedAt <= todayEnd
    }).length

    // Today's Leaders (users who activated leader program today)
    const todayLeaders = userPackages.filter(p => {
      if (p.status !== 'active') return false
      if (p.packageId !== 'LEADER_PROGRAM' && p.packageName !== 'Leader Program') return false
      const activatedAt = p.activatedAt?.toDate?.() || p.createdAt?.toDate?.()
      if (!activatedAt) return false
      return activatedAt >= today && activatedAt <= todayEnd
    }).length

    // Today's Registrations
    const todayRegistrations = users.filter(u => {
      const createdAt = u.createdAt?.toDate?.()
      if (!createdAt) return false
      return createdAt >= today && createdAt <= todayEnd
    }).length

    return {
      totalInvest,
      todayInvest,
      inactiveUsers,
      totalLeaders,
      totalInvestors,
      todayInvestors,
      todayLeaders,
      todayRegistrations
    }
  }, [users, userPackages])

  const activeUsers = users.filter(u => u.status === 'active' || u.status === 'ACTIVE_INVESTOR' || u.status === 'ACTIVE_LEADER').length
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
              <p className="text-gray-400 text-sm mb-1">Inactive Users</p>
              <p className="text-2xl font-bold text-white">{metrics.inactiveUsers}</p>
            </div>
            <UserX className="text-red-500" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Investment</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(metrics.totalInvest, 'INR')}</p>
            </div>
            <DollarSign className="text-green-500" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Today's Investment</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(metrics.todayInvest, 'INR')}</p>
            </div>
            <Calendar className="text-primary" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Leaders</p>
              <p className="text-2xl font-bold text-white">{metrics.totalLeaders}</p>
            </div>
            <UserCheck className="text-purple-500" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Investors</p>
              <p className="text-2xl font-bold text-white">{metrics.totalInvestors}</p>
            </div>
            <TrendingUp className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Today's Investors</p>
              <p className="text-2xl font-bold text-white">{metrics.todayInvestors}</p>
            </div>
            <Users className="text-blue-400" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Today's Leaders</p>
              <p className="text-2xl font-bold text-white">{metrics.todayLeaders}</p>
            </div>
            <Users className="text-purple-400" size={32} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Today's Registrations</p>
              <p className="text-2xl font-bold text-white">{metrics.todayRegistrations}</p>
            </div>
            <Calendar className="text-yellow-500" size={32} />
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

