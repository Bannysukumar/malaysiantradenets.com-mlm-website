import { useState, useMemo } from 'react'
import { useCollection } from '../../hooks/useFirestore'
import { query, where, orderBy, collection } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { DollarSign, Download, Filter, TrendingUp, Users } from 'lucide-react'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { Link } from 'react-router-dom'

export default function AdminReferralIncomeReport() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [uplineFilter, setUplineFilter] = useState('')
  const [packageFilter, setPackageFilter] = useState('')

  const { data: allIncomeEntries, loading } = useCollection('incomeLedger', [])
  const { data: allUsers } = useCollection('users', [])
  const { data: allPackages } = useCollection('userPackages', [])

  // Get all referral income entries
  const referralIncomeEntries = useMemo(() => {
    if (!allIncomeEntries) return []
    
    const entries = []
    allIncomeEntries.forEach(userEntries => {
      if (userEntries.entries) {
        userEntries.entries.forEach(entry => {
          if (entry.type === 'REFERRAL_DIRECT') {
            entries.push({
              ...entry,
              userId: userEntries.id
            })
          }
        })
      }
    })
    return entries
  }, [allIncomeEntries])

  // Filter entries
  const filteredEntries = useMemo(() => {
    let filtered = referralIncomeEntries

    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      filtered = filtered.filter(e => {
        const entryDate = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt)
        return entryDate >= fromDate
      })
    }

    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      filtered = filtered.filter(e => {
        const entryDate = e.createdAt?.toDate ? e.createdAt.toDate() : new Date(e.createdAt)
        return entryDate <= toDate
      })
    }

    if (uplineFilter) {
      filtered = filtered.filter(e => {
        const upline = allUsers.find(u => u.id === e.userId)
        return upline?.name?.toLowerCase().includes(uplineFilter.toLowerCase()) ||
               upline?.email?.toLowerCase().includes(uplineFilter.toLowerCase()) ||
               upline?.id === uplineFilter
      })
    }

    if (packageFilter) {
      filtered = filtered.filter(e => {
        const pkg = allPackages.find(p => p.id === e.metadata?.packageId)
        return pkg?.packageName === packageFilter
      })
    }

    return filtered.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt)
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt)
      return dateB - dateA
    })
  }, [referralIncomeEntries, dateFrom, dateTo, uplineFilter, packageFilter, allUsers, allPackages])

  // Calculate totals
  const totals = useMemo(() => {
    const totalPaid = filteredEntries
      .filter(e => e.status === 'APPROVED' || e.status === 'completed')
      .reduce((sum, e) => sum + (e.amount || 0), 0)
    
    const totalPending = filteredEntries
      .filter(e => e.status === 'PENDING')
      .reduce((sum, e) => sum + (e.amount || 0), 0)

    const uniqueUplines = new Set(filteredEntries.map(e => e.userId))
    const uniqueReferees = new Set(filteredEntries.map(e => e.metadata?.sourceUid).filter(Boolean))

    return {
      totalPaid,
      totalPending,
      totalEntries: filteredEntries.length,
      uniqueUplines: uniqueUplines.size,
      uniqueReferees: uniqueReferees.size
    }
  }, [filteredEntries])

  // Top referrers
  const topReferrers = useMemo(() => {
    const referrerMap = {}
    filteredEntries
      .filter(e => e.status === 'APPROVED' || e.status === 'completed')
      .forEach(entry => {
        if (!referrerMap[entry.userId]) {
          referrerMap[entry.userId] = { userId: entry.userId, total: 0, count: 0 }
        }
        referrerMap[entry.userId].total += entry.amount || 0
        referrerMap[entry.userId].count += 1
      })
    
    return Object.values(referrerMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map(ref => {
        const user = allUsers.find(u => u.id === ref.userId)
        return {
          ...ref,
          name: user?.name || 'N/A',
          email: user?.email || 'N/A'
        }
      })
  }, [filteredEntries, allUsers])

  const handleExportCSV = () => {
    const headers = ['Date', 'Upline', 'Upline Email', 'Referee', 'Amount', 'Status', 'Package', 'Description']
    const rows = filteredEntries.map(entry => {
      const upline = allUsers.find(u => u.id === entry.userId)
      const referee = allUsers.find(u => u.id === entry.metadata?.sourceUid)
      const pkg = allPackages.find(p => p.id === entry.metadata?.packageId)
      
      return [
        entry.createdAt ? formatDate(entry.createdAt) : 'N/A',
        upline?.name || 'N/A',
        upline?.email || 'N/A',
        referee?.name || referee?.email || 'N/A',
        entry.amount || 0,
        entry.status || 'N/A',
        pkg?.packageName || 'N/A',
        entry.description || 'N/A'
      ]
    })

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `referral-income-report-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Report exported successfully')
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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <DollarSign className="text-primary" size={32} />
          Referral Income Report
        </h1>
        <button
          onClick={handleExportCSV}
          className="btn-secondary flex items-center gap-2"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="card">
          <h3 className="text-sm text-gray-400 mb-2">Total Paid</h3>
          <p className="text-2xl font-bold text-green-500">{formatCurrency(totals.totalPaid, 'INR')}</p>
        </div>
        <div className="card">
          <h3 className="text-sm text-gray-400 mb-2">Total Pending</h3>
          <p className="text-2xl font-bold text-yellow-500">{formatCurrency(totals.totalPending, 'INR')}</p>
        </div>
        <div className="card">
          <h3 className="text-sm text-gray-400 mb-2">Total Entries</h3>
          <p className="text-2xl font-bold text-white">{totals.totalEntries}</p>
        </div>
        <div className="card">
          <h3 className="text-sm text-gray-400 mb-2">Active Referrers</h3>
          <p className="text-2xl font-bold text-primary">{totals.uniqueUplines}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Filter className="text-primary" size={24} />
          Filters
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Upline (Name/Email/ID)</label>
            <input
              type="text"
              value={uplineFilter}
              onChange={(e) => setUplineFilter(e.target.value)}
              placeholder="Search upline..."
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Package</label>
            <select
              value={packageFilter}
              onChange={(e) => setPackageFilter(e.target.value)}
              className="input-field"
            >
              <option value="">All Packages</option>
              {Array.from(new Set(allPackages.map(p => p.packageName))).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Top Referrers */}
      {topReferrers.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="text-primary" size={24} />
            Top Referrers
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 font-semibold">Rank</th>
                  <th className="text-left py-3 px-4 font-semibold">Name</th>
                  <th className="text-left py-3 px-4 font-semibold">Email</th>
                  <th className="text-left py-3 px-4 font-semibold">Total Earned</th>
                  <th className="text-left py-3 px-4 font-semibold">Referrals</th>
                  <th className="text-left py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {topReferrers.map((ref, index) => (
                  <tr key={ref.userId} className="border-b border-gray-800 hover:bg-dark-lighter">
                    <td className="py-3 px-4">#{index + 1}</td>
                    <td className="py-3 px-4">{ref.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-400">{ref.email}</td>
                    <td className="py-3 px-4 font-semibold text-green-500">
                      {formatCurrency(ref.total, 'INR')}
                    </td>
                    <td className="py-3 px-4">{ref.count}</td>
                    <td className="py-3 px-4">
                      <Link
                        to={`/admin/users/${ref.userId}`}
                        className="text-primary hover:underline text-sm"
                      >
                        View User
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Referral Income Table */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Referral Income Details</h2>
        {filteredEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <DollarSign className="mx-auto mb-4" size={48} />
            <p>No referral income entries found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 font-semibold">Upline</th>
                  <th className="text-left py-3 px-4 font-semibold">Referee</th>
                  <th className="text-left py-3 px-4 font-semibold">Amount</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 font-semibold">Package</th>
                  <th className="text-left py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const upline = allUsers.find(u => u.id === entry.userId)
                  const referee = allUsers.find(u => u.id === entry.metadata?.sourceUid)
                  const pkg = allPackages.find(p => p.id === entry.metadata?.packageId)
                  
                  return (
                    <tr key={entry.id} className="border-b border-gray-800 hover:bg-dark-lighter">
                      <td className="py-3 px-4 text-sm">
                        {entry.createdAt ? formatDate(entry.createdAt) : 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <Link to={`/admin/users/${entry.userId}`} className="text-primary hover:underline">
                          {upline?.name || upline?.email || entry.userId}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        {referee ? (
                          <Link to={`/admin/users/${referee.id}`} className="text-primary hover:underline">
                            {referee.name || referee.email}
                          </Link>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-green-500">
                        {formatCurrency(entry.amount || 0, 'INR')}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`badge ${
                          entry.status === 'APPROVED' || entry.status === 'completed' ? 'bg-green-500' :
                          entry.status === 'PENDING' ? 'bg-yellow-500' :
                          'bg-gray-500'
                        }`}>
                          {entry.status || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4">{pkg?.packageName || 'N/A'}</td>
                      <td className="py-3 px-4">
                        <Link
                          to={`/admin/users/${entry.userId}`}
                          className="text-primary hover:underline text-sm"
                        >
                          View Upline
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

