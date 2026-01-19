import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import { query, where, orderBy, collection } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { DollarSign, Filter, Download } from 'lucide-react'
import { format } from 'date-fns'

export default function IncomeHistory() {
  const { user } = useAuth()
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // No need for userId filter since we're querying the user's specific subcollection
  const constraints = user?.uid ? [
    orderBy('createdAt', 'desc')
  ] : []

  const { data: incomeEntries, loading } = useCollection(
    user?.uid ? `incomeLedger/${user.uid}/entries` : 'incomeLedger',
    constraints
  )

  const filteredEntries = incomeEntries.filter(entry => {
    if (typeFilter !== 'all' && entry.type !== typeFilter) return false
    // Handle case-insensitive status matching (APPROVED vs approved, etc.)
    if (statusFilter !== 'all') {
      const entryStatus = entry.status?.toLowerCase() || ''
      const filterStatus = statusFilter.toLowerCase()
      if (entryStatus !== filterStatus) return false
    }
    if (dateFrom || dateTo) {
      const entryDate = entry.createdAt?.toDate ? entry.createdAt.toDate() : new Date(entry.createdAt)
      if (dateFrom && entryDate < new Date(dateFrom)) return false
      if (dateTo && entryDate > new Date(dateTo)) return false
    }
    return true
  })

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'Amount', 'Status', 'Description', 'Reference']
    const rows = filteredEntries.map(entry => [
      formatDate(entry.createdAt),
      entry.type || 'N/A',
      entry.amount || 0,
      entry.status || 'N/A',
      entry.description || '',
      entry.reference || ''
    ])
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `income-history-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  const getTypeLabel = (type, entry = null) => {
    const labels = {
      REFERRAL_DIRECT: 'Direct Referral (Level 1)',
      REFERRAL_LEVEL: entry?.metadata?.level 
        ? `Level ${entry.metadata.level} Referral`
        : 'Level Referral',
      direct_referral: 'Direct Referral',
      level_income: 'Level Income',
      achievement_level_income: 'Achievement Level Income',
      daily_roi: 'Daily ROI',
      bonus: 'Bonus',
      admin_adjust: 'Admin Adjustment',
      admin_credit: 'Admin Credit'
    }
    if (type === 'REFERRAL_LEVEL' && entry) {
      return labels[type]
    }
    return labels[type] || type
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: 'text-yellow-500',
      approved: 'text-green-500',
      paid: 'text-blue-500',
      rejected: 'text-red-500'
    }
    return colors[status] || 'text-gray-400'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <DollarSign className="text-primary" size={32} />
          Income History
        </h1>
        <button
          onClick={exportToCSV}
          className="btn-secondary flex items-center gap-2"
        >
          <Download size={20} />
          Export CSV
        </button>
      </div>

      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="text-gray-400" size={20} />
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input-field"
            >
              <option value="all">All Types</option>
              <option value="REFERRAL_DIRECT">Direct Referral (Level 1)</option>
              <option value="REFERRAL_LEVEL">Level Referral (Level 2+)</option>
              <option value="direct_referral">Direct Referral (Legacy)</option>
              <option value="level_income">Level Income</option>
              <option value="achievement_level_income">Achievement Level Income</option>
              <option value="daily_roi">Daily ROI</option>
              <option value="bonus">Bonus</option>
              <option value="admin_adjust">Admin Adjustment</option>
              <option value="admin_credit">Admin Credit</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="completed">Completed</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-4 px-4 font-semibold">Date</th>
              <th className="text-left py-4 px-4 font-semibold">Type</th>
              <th className="text-left py-4 px-4 font-semibold">Amount</th>
              <th className="text-left py-4 px-4 font-semibold">Status</th>
              <th className="text-left py-4 px-4 font-semibold">Description</th>
              <th className="text-left py-4 px-4 font-semibold">Reference</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-gray-400">
                  No income entries found
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-800 hover:bg-dark-lighter">
                  <td className="py-4 px-4 text-sm">
                    {formatDate(entry.createdAt)}
                  </td>
                  <td className="py-4 px-4">
                    {getTypeLabel(entry.type, entry)}
                  </td>
                  <td className="py-4 px-4 font-semibold text-primary">
                    {formatCurrency(entry.amount || 0, 'INR')}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`capitalize ${getStatusColor(entry.status)}`}>
                      {entry.status || 'N/A'}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-400">
                    {entry.description || 'N/A'}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-400 font-mono">
                    {entry.reference || 'N/A'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

