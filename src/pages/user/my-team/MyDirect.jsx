import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useCollection } from '../../../hooks/useFirestore'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../../config/firebase'
import { formatCurrency, formatDate } from '../../../utils/helpers'
import toast from 'react-hot-toast'
import { Users, Search } from 'lucide-react'

export default function MyDirect() {
  const { userData, user } = useAuth()
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [directMembers, setDirectMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const { data: userPackages } = useCollection('userPackages', [])

  // Get active packages map
  const activePackagesMap = useMemo(() => {
    const map = {}
    userPackages.forEach(pkg => {
      if (pkg.status === 'active' && pkg.userId) {
        if (!map[pkg.userId] || (pkg.amount || pkg.inrPrice || 0) > (map[pkg.userId]?.amount || map[pkg.userId]?.inrPrice || 0)) {
          map[pkg.userId] = pkg
        }
      }
    })
    return map
  }, [userPackages])

  useEffect(() => {
    const loadDirectMembers = async () => {
      if (!user?.uid && !userData?.id) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const currentUserUid = user?.uid || userData?.id
        
        // Get direct referrals
        const directRef = collection(db, 'users')
        const q = query(directRef, where('referredByUid', '==', currentUserUid))
        const snapshot = await getDocs(q)
        
        const members = []
        snapshot.forEach(doc => {
          const data = doc.data()
          members.push({
            id: doc.id,
            ...data
          })
        })

        setDirectMembers(members)
      } catch (error) {
        console.error('Error loading direct members:', error)
        toast.error('Error loading direct members')
      } finally {
        setLoading(false)
      }
    }

    loadDirectMembers()
  }, [userData])

  // Filter and search
  const filteredMembers = useMemo(() => {
    let filtered = directMembers

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(member => {
        const status = member.status || 'active'
        switch (statusFilter) {
          case 'active':
            return status === 'active' || status === 'ACTIVE_INVESTOR' || status === 'ACTIVE_LEADER'
          case 'inactive':
            return status !== 'active' && status !== 'ACTIVE_INVESTOR' && status !== 'ACTIVE_LEADER' && status !== 'blocked' && status !== 'PENDING_ACTIVATION'
          case 'blocked':
            return status === 'blocked' || status === 'AUTO_BLOCKED'
          case 'pending':
            return status === 'PENDING_ACTIVATION'
          default:
            return true
        }
      })
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(member =>
        member.userId?.toLowerCase().includes(searchLower) ||
        member.name?.toLowerCase().includes(searchLower) ||
        member.phone?.includes(searchTerm) ||
        member.email?.toLowerCase().includes(searchLower)
      )
    }

    return filtered
  }, [directMembers, statusFilter, searchTerm])

  // Pagination
  const totalPages = Math.ceil(filteredMembers.length / pageSize)
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredMembers.slice(start, start + pageSize)
  }, [filteredMembers, currentPage, pageSize])

  const getInvestAmount = (memberId) => {
    const pkg = activePackagesMap[memberId]
    if (!pkg) return 0
    return pkg.amount || pkg.inrPrice || 0
  }

  const getStatusBadge = (status) => {
    const statusValue = status || 'active'
    if (statusValue === 'ACTIVE_INVESTOR' || statusValue === 'ACTIVE_LEADER' || statusValue === 'active') {
      return <span className="badge bg-green-500">Active</span>
    }
    if (statusValue === 'PENDING_ACTIVATION') {
      return <span className="badge bg-yellow-500">Pending</span>
    }
    if (statusValue === 'blocked' || statusValue === 'AUTO_BLOCKED') {
      return <span className="badge bg-red-500">Blocked</span>
    }
    return <span className="badge bg-gray-500">Inactive</span>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <Users className="text-primary" size={32} />
        My Direct
      </h1>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Filter By Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="input-field"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="blocked">Blocked</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="flex-1 flex items-center gap-2">
            <Search className="text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by username, name, mobile..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="input-field flex-1"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Show entries:</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="input-field"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-4 px-4 font-semibold">S.No</th>
                <th className="text-left py-4 px-4 font-semibold">Username</th>
                <th className="text-left py-4 px-4 font-semibold">Name</th>
                <th className="text-left py-4 px-4 font-semibold">Mobile No.</th>
                <th className="text-left py-4 px-4 font-semibold">Invest Amount</th>
                <th className="text-left py-4 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    No direct members found
                  </td>
                </tr>
              ) : (
                paginatedMembers.map((member, index) => (
                  <tr key={member.id} className={`border-b border-gray-800 ${index % 2 === 0 ? 'bg-dark-lighter' : ''} hover:bg-dark-light`}>
                    <td className="py-4 px-4">{(currentPage - 1) * pageSize + index + 1}</td>
                    <td className="py-4 px-4 font-mono text-primary">{member.userId || 'N/A'}</td>
                    <td className="py-4 px-4">{member.name || 'N/A'}</td>
                    <td className="py-4 px-4">{member.phone || 'N/A'}</td>
                    <td className="py-4 px-4">{formatCurrency(getInvestAmount(member.id), 'INR')}</td>
                    <td className="py-4 px-4">{getStatusBadge(member.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
              <div className="text-sm text-gray-400">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredMembers.length)} of {filteredMembers.length} entries
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="flex items-center px-4 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

