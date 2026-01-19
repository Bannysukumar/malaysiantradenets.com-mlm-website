import { useState, useMemo } from 'react'
import { useCollection } from '../../hooks/useFirestore'
import { doc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { Users, Search, Shield, Ban, Download, Filter, MoreVertical, Eye } from 'lucide-react'
import { formatDate } from '../../utils/helpers'
import { useNavigate } from 'react-router-dom'
import { formatCurrency } from '../../utils/helpers'

export default function AdminUsers() {
  const { data: users, loading, error } = useCollection('users', [])
  const { data: wallets } = useCollection('wallets', [])
  const { data: userPackages } = useCollection('userPackages', [])
  const { data: withdrawals } = useCollection('withdrawals', [])
  const { data: packages } = useCollection('packages', [])
  
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [filters, setFilters] = useState({
    status: '',
    programType: '',
    plan: '',
    kyc: '',
    bank: '',
    withdrawals: '',
    referralRange: ''
  })
  const [sortBy, setSortBy] = useState('newest')
  const [showFilters, setShowFilters] = useState(false)

  // Create lookup maps for performance
  const walletMap = useMemo(() => {
    const map = {}
    wallets.forEach(w => {
      if (w.id) map[w.id] = w
    })
    return map
  }, [wallets])

  const packageMap = useMemo(() => {
    const map = {}
    userPackages.forEach(pkg => {
      if (pkg.userId && pkg.status === 'active') {
        // If no package stored yet, store this one
        if (!map[pkg.userId]) {
          map[pkg.userId] = pkg
        } else {
          // If we already have a package, prioritize Investor plans over Leader Program
          const existingIsLeader = map[pkg.userId].packageId === 'LEADER_PROGRAM' || map[pkg.userId].packageName === 'Leader Program'
          const currentIsLeader = pkg.packageId === 'LEADER_PROGRAM' || pkg.packageName === 'Leader Program'
          
          // Replace if existing is Leader and current is not Leader
          if (existingIsLeader && !currentIsLeader) {
            map[pkg.userId] = pkg
          }
          // Replace if both are not Leader, prefer the newer one (or keep existing if same)
          else if (!existingIsLeader && !currentIsLeader) {
            // Prefer the one with higher amount (Investor plan) or newer activation
            const existingAmount = map[pkg.userId].amount || map[pkg.userId].inrPrice || 0
            const currentAmount = pkg.amount || pkg.inrPrice || 0
            if (currentAmount > existingAmount) {
              map[pkg.userId] = pkg
            }
          }
        }
      }
    })
    return map
  }, [userPackages])

  // Create lookup map for package names
  const packageNameMap = useMemo(() => {
    const map = {}
    packages.forEach(pkg => {
      if (pkg.id) map[pkg.id] = pkg.name
    })
    return map
  }, [packages])

  const withdrawalMap = useMemo(() => {
    const map = {}
    withdrawals.forEach(w => {
      if (w.uid && w.status === 'pending') {
        if (!map[w.uid]) map[w.uid] = []
        map[w.uid].push(w)
      }
    })
    return map
  }, [withdrawals])

  // Get directs count for each user
  const directsCountMap = useMemo(() => {
    const map = {}
    users.forEach(user => {
      if (user.referredByUid) {
        map[user.referredByUid] = (map[user.referredByUid] || 0) + 1
      }
    })
    return map
  }, [users])

  // Filter and search users
  const filteredUsers = useMemo(() => {
    let filtered = users.filter(user => {
      // Search
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = !searchTerm || 
        user.name?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.phone?.toLowerCase().includes(searchLower) ||
        user.refCode?.toLowerCase().includes(searchLower) ||
        user.id?.toLowerCase().includes(searchLower)

      if (!matchesSearch) return false

      // Status filter
      if (filters.status && user.status !== filters.status) return false

      // Program type filter
      if (filters.programType && user.programType !== filters.programType) return false

      // Plan filter
      if (filters.plan) {
        const userPlan = packageMap[user.id]
        if (filters.plan === 'none' && userPlan) return false
        if (filters.plan !== 'none' && (!userPlan || userPlan.packageName !== filters.plan)) return false
      }

      // KYC filter
      if (filters.kyc === 'verified' && !user.kycVerified) return false
      if (filters.kyc === 'not_verified' && user.kycVerified) return false

      // Bank filter
      if (filters.bank === 'verified' && !user.bankVerified) return false
      if (filters.bank === 'not_verified' && user.bankVerified) return false
      if (filters.bank === 'missing' && user.bankVerified !== false) return false

      // Withdrawals filter
      if (filters.withdrawals === 'pending' && !withdrawalMap[user.id]?.length) return false
      if (filters.withdrawals === 'rejected' && !withdrawals.some(w => w.uid === user.id && w.status === 'rejected')) return false
      if (filters.withdrawals === 'paid' && !withdrawals.some(w => w.uid === user.id && w.status === 'paid')) return false

      // Referral range filter
      if (filters.referralRange) {
        const directs = directsCountMap[user.id] || 0
        if (filters.referralRange === '0-3' && (directs < 0 || directs > 3)) return false
        if (filters.referralRange === '4-10' && (directs < 4 || directs > 10)) return false
        if (filters.referralRange === '10+' && directs < 10) return false
      }

      return true
    })

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt?.toDate?.() || 0) - new Date(a.createdAt?.toDate?.() || 0)
        case 'oldest':
          return new Date(a.createdAt?.toDate?.() || 0) - new Date(b.createdAt?.toDate?.() || 0)
        case 'wallet_high':
          return (walletMap[b.id]?.availableBalance || 0) - (walletMap[a.id]?.availableBalance || 0)
        case 'wallet_low':
          return (walletMap[a.id]?.availableBalance || 0) - (walletMap[b.id]?.availableBalance || 0)
        case 'directs_high':
          return (directsCountMap[b.id] || 0) - (directsCountMap[a.id] || 0)
        case 'withdrawals_high':
          return (withdrawals.filter(w => w.uid === b.id).length) - (withdrawals.filter(w => w.uid === a.id).length)
        default:
          return 0
      }
    })

    return filtered
  }, [users, searchTerm, filters, sortBy, walletMap, packageMap, withdrawalMap, directsCountMap, withdrawals])

  const handleBulkAction = async (action) => {
    if (selectedUsers.length === 0) {
      toast.error('Please select users first')
      return
    }

    try {
      const batch = writeBatch(db)
      
      for (const userId of selectedUsers) {
        const userRef = doc(db, 'users', userId)
        switch (action) {
          case 'block':
            batch.update(userRef, { status: 'blocked' })
            break
          case 'unblock':
            batch.update(userRef, { status: 'active' })
            break
          case 'disable_transfers':
            batch.update(userRef, { transfersDisabled: true })
            break
          case 'enable_transfers':
            batch.update(userRef, { transfersDisabled: false })
            break
          case 'disable_withdrawals':
            batch.update(userRef, { withdrawalsDisabled: true })
            break
          case 'enable_withdrawals':
            batch.update(userRef, { withdrawalsDisabled: false })
            break
        }
      }

      await batch.commit()
      toast.success(`${action} applied to ${selectedUsers.length} users`)
      setSelectedUsers([])
    } catch (error) {
      console.error('Error performing bulk action:', error)
      toast.error('Error performing bulk action')
    }
  }

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Ref Code', 'Program Type', 'Status', 'Plan', 'Wallet Available', 'Directs', 'KYC', 'Bank', 'Created']
    const rows = filteredUsers.map(user => {
      const wallet = walletMap[user.id] || {}
      const pkg = packageMap[user.id]
      return [
        user.name || 'N/A',
        user.email || 'N/A',
        user.phone || 'N/A',
        user.refCode || 'N/A',
        user.programType || 'Not Selected',
        user.status || 'active',
        pkg?.packageName || 'None',
        wallet.availableBalance || 0,
        directsCountMap[user.id] || 0,
        user.kycVerified ? 'Yes' : 'No',
        user.bankVerified ? 'Yes' : 'No',
        user.createdAt ? formatDate(user.createdAt) : 'N/A'
      ]
    })

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `users_export_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
          <Users className="text-primary" size={32} />
          User Management
        </h1>
        <div className="card">
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">Error loading users: {error?.message || 'Unknown error'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="text-primary" size={32} />
          User Management
          <span className="text-lg text-gray-400 font-normal ml-2">({filteredUsers.length} of {users.length})</span>
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="btn-secondary flex items-center gap-2"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 flex items-center gap-2">
            <Search className="text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, email, phone, ref code, UID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field flex-1"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center gap-2"
          >
            <Filter size={18} />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t border-gray-700">
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="input-field"
              >
                <option value="">All</option>
                <option value="PENDING_ACTIVATION">Pending Activation</option>
                <option value="ACTIVE_INVESTOR">Active Investor</option>
                <option value="ACTIVE_LEADER">Active Leader</option>
                <option value="AUTO_BLOCKED">Auto Blocked</option>
                <option value="blocked">Blocked</option>
                <option value="active">Active (Legacy)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Program Type</label>
              <select
                value={filters.programType || ''}
                onChange={(e) => setFilters({...filters, programType: e.target.value})}
                className="input-field"
              >
                <option value="">All</option>
                <option value="investor">Investor</option>
                <option value="leader">Leader</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Plan</label>
              <select
                value={filters.plan}
                onChange={(e) => setFilters({...filters, plan: e.target.value})}
                className="input-field"
              >
                <option value="">All</option>
                <option value="none">None</option>
                {/* Add plan options dynamically */}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">KYC</label>
              <select
                value={filters.kyc}
                onChange={(e) => setFilters({...filters, kyc: e.target.value})}
                className="input-field"
              >
                <option value="">All</option>
                <option value="verified">Verified</option>
                <option value="not_verified">Not Verified</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Bank</label>
              <select
                value={filters.bank}
                onChange={(e) => setFilters({...filters, bank: e.target.value})}
                className="input-field"
              >
                <option value="">All</option>
                <option value="verified">Verified</option>
                <option value="not_verified">Not Verified</option>
                <option value="missing">Missing</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Withdrawals</label>
              <select
                value={filters.withdrawals}
                onChange={(e) => setFilters({...filters, withdrawals: e.target.value})}
                className="input-field"
              >
                <option value="">All</option>
                <option value="pending">Has Pending</option>
                <option value="rejected">Has Rejected</option>
                <option value="paid">Has Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Directs</label>
              <select
                value={filters.referralRange}
                onChange={(e) => setFilters({...filters, referralRange: e.target.value})}
                className="input-field"
              >
                <option value="">All</option>
                <option value="0-3">0-3</option>
                <option value="4-10">4-10</option>
                <option value="10+">10+</option>
              </select>
            </div>
          </div>
        )}

        {/* Sort */}
        <div className="flex items-center gap-2 pt-4 border-t border-gray-700 mt-4">
          <label className="text-sm font-medium">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-field"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="wallet_high">Highest Wallet</option>
            <option value="wallet_low">Lowest Wallet</option>
            <option value="directs_high">Most Directs</option>
            <option value="withdrawals_high">Most Withdrawals</option>
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedUsers.length > 0 && (
          <div className="flex items-center gap-2 pt-4 border-t border-gray-700 mt-4">
            <span className="text-sm text-gray-400">{selectedUsers.length} selected</span>
            <div className="flex gap-2">
              <button onClick={() => handleBulkAction('block')} className="btn-secondary text-sm">Block</button>
              <button onClick={() => handleBulkAction('unblock')} className="btn-secondary text-sm">Unblock</button>
              <button onClick={() => handleBulkAction('disable_transfers')} className="btn-secondary text-sm">Disable Transfers</button>
              <button onClick={() => handleBulkAction('disable_withdrawals')} className="btn-secondary text-sm">Disable Withdrawals</button>
              <button onClick={() => setSelectedUsers([])} className="btn-secondary text-sm">Clear</button>
            </div>
          </div>
        )}
      </div>

      {/* Users Table */}
      {filteredUsers.length === 0 ? (
        <div className="card">
          <div className="text-center py-12">
            <Users className="text-gray-400 mx-auto mb-4" size={48} />
            <p className="text-gray-400 text-lg mb-2">No users found</p>
          </div>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-4 px-4 font-semibold">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers(filteredUsers.map(u => u.id))
                      } else {
                        setSelectedUsers([])
                      }
                    }}
                    className="rounded"
                  />
                </th>
                <th className="text-left py-4 px-4 font-semibold">Name</th>
                <th className="text-left py-4 px-4 font-semibold">Email</th>
                <th className="text-left py-4 px-4 font-semibold">Phone</th>
                <th className="text-left py-4 px-4 font-semibold">Ref Code</th>
                <th className="text-left py-4 px-4 font-semibold">Program</th>
                <th className="text-left py-4 px-4 font-semibold">Plan</th>
                <th className="text-left py-4 px-4 font-semibold">Wallet</th>
                <th className="text-left py-4 px-4 font-semibold">Directs</th>
                <th className="text-left py-4 px-4 font-semibold">Status</th>
                <th className="text-left py-4 px-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const wallet = walletMap[user.id] || {}
                const pkg = packageMap[user.id]
                const pendingWithdrawals = withdrawalMap[user.id]?.length || 0
                const directs = directsCountMap[user.id] || 0

                return (
                  <tr key={user.id} className="border-b border-gray-800 hover:bg-dark-lighter">
                    <td className="py-4 px-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers([...selectedUsers, user.id])
                          } else {
                            setSelectedUsers(selectedUsers.filter(id => id !== user.id))
                          }
                        }}
                        className="rounded"
                      />
                    </td>
                    <td className="py-4 px-4">{user.name || 'N/A'}</td>
                    <td className="py-4 px-4">{user.email}</td>
                    <td className="py-4 px-4">{user.phone || 'N/A'}</td>
                    <td className="py-4 px-4 font-mono text-sm">{user.refCode}</td>
                    <td className="py-4 px-4">
                      {user.programType ? (
                        <span className={`badge ${
                          user.programType === 'investor' ? 'bg-blue-500' : 'bg-purple-500'
                        }`}>
                          {user.programType === 'investor' ? 'Investor' : 'Leader'}
                        </span>
                      ) : (
                        <span className="badge bg-gray-500">Not Selected</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {(() => {
                        if (!pkg) return <span className="badge bg-gray-500">None</span>
                        
                        // Check if it's a Leader program
                        if (pkg.packageId === 'LEADER_PROGRAM' || pkg.packageName === 'Leader Program') {
                          return <span className="badge bg-purple-500">Leader Program</span>
                        }
                        
                        // Use packageName if available, otherwise look up from packages collection
                        const displayName = pkg.packageName || packageNameMap[pkg.packageId] || pkg.packageId || 'Unknown'
                        return <span className="badge">{displayName}</span>
                      })()}
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm">
                        <div>Available: {formatCurrency(wallet.availableBalance || 0)}</div>
                        <div className="text-gray-400">Pending: {formatCurrency(wallet.pendingBalance || 0)}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm">
                        <div>{directs} directs</div>
                        {pendingWithdrawals > 0 && (
                          <div className="text-yellow-500">{pendingWithdrawals} pending withdrawals</div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col gap-1">
                        <span className={`badge ${
                          user.status === 'ACTIVE_INVESTOR' || user.status === 'ACTIVE_LEADER' ? 'bg-green-500' :
                          user.status === 'PENDING_ACTIVATION' ? 'bg-yellow-500' :
                          user.status === 'AUTO_BLOCKED' ? 'bg-red-500' :
                          user.status === 'blocked' ? 'bg-red-500' :
                          user.status === 'active' ? 'bg-green-500' :
                          'bg-gray-500'
                        }`}>
                          {(() => {
                            const status = user.status || 'active'
                            // Format status for display
                            if (status === 'ACTIVE_INVESTOR') return 'Active Investor'
                            if (status === 'ACTIVE_LEADER') return 'Active Leader'
                            if (status === 'PENDING_ACTIVATION') return 'Pending Activation'
                            if (status === 'AUTO_BLOCKED') return 'Auto Blocked'
                            return status.charAt(0).toUpperCase() + status.slice(1)
                          })()}
                        </span>
                        {user.kycVerified && <span className="badge bg-blue-500 text-xs">KYC</span>}
                        {user.bankVerified && <span className="badge bg-purple-500 text-xs">Bank</span>}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => navigate(`/admin/users/${user.id}`)}
                        className="btn-primary text-sm flex items-center gap-1"
                      >
                        <Eye size={16} />
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
