import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import { query, where, orderBy } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { History, Filter, ArrowUp, ArrowDown } from 'lucide-react'
import { format } from 'date-fns'

export default function UserTransferHistory() {
  const { user } = useAuth()
  const [filter, setFilter] = useState('all') // all, sent, received
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const sentConstraints = user?.uid ? [
    where('senderUid', '==', user.uid),
    orderBy('createdAt', 'desc')
  ] : []

  const receivedConstraints = user?.uid ? [
    where('recipientUid', '==', user.uid),
    orderBy('createdAt', 'desc')
  ] : []

  const { data: sentTransfers } = useCollection('transfers', sentConstraints)
  const { data: receivedTransfers } = useCollection('transfers', receivedConstraints)

  const allTransfers = [
    ...sentTransfers.map(t => ({ ...t, type: 'sent' })),
    ...receivedTransfers.map(t => ({ ...t, type: 'received' }))
  ].sort((a, b) => {
    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt)
    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt)
    return dateB - dateA
  })

  const filteredTransfers = allTransfers.filter(transfer => {
    if (filter !== 'all' && transfer.type !== filter) return false
    if (dateFrom || dateTo) {
      const transferDate = transfer.createdAt?.toDate ? transfer.createdAt.toDate() : new Date(transfer.createdAt)
      if (dateFrom && transferDate < new Date(dateFrom)) return false
      if (dateTo && transferDate > new Date(dateTo)) return false
    }
    return true
  })

  const maskEmail = (email) => {
    if (!email) return 'N/A'
    const [name, domain] = email.split('@')
    if (name.length <= 2) return `${name[0]}***@${domain}`
    return `${name.substring(0, 2)}***@${domain}`
  }

  const getStatusColor = (status) => {
    const colors = {
      initiated: 'text-yellow-500',
      completed: 'text-green-500',
      rejected: 'text-red-500'
    }
    return colors[status] || 'text-gray-400'
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <History className="text-primary" size={32} />
        Transfer History
      </h1>

      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="text-gray-400" size={20} />
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Type</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input-field"
            >
              <option value="all">All Transfers</option>
              <option value="sent">Sent</option>
              <option value="received">Received</option>
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
              <th className="text-left py-4 px-4 font-semibold">Recipient/Sender</th>
              <th className="text-left py-4 px-4 font-semibold">Amount</th>
              <th className="text-left py-4 px-4 font-semibold">Fee</th>
              <th className="text-left py-4 px-4 font-semibold">Status</th>
              <th className="text-left py-4 px-4 font-semibold">Note</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransfers.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-8 text-gray-400">
                  No transfers found
                </td>
              </tr>
            ) : (
              filteredTransfers.map((transfer) => (
                <tr key={transfer.id} className="border-b border-gray-800 hover:bg-dark-lighter">
                  <td className="py-4 px-4 text-sm">
                    {formatDate(transfer.createdAt)}
                  </td>
                  <td className="py-4 px-4">
                    {transfer.type === 'sent' ? (
                      <span className="flex items-center gap-1 text-red-500">
                        <ArrowUp size={16} />
                        Sent
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-500">
                        <ArrowDown size={16} />
                        Received
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-sm">
                    {transfer.type === 'sent' 
                      ? maskEmail(transfer.recipientEmailSnapshot)
                      : maskEmail(transfer.senderEmailSnapshot || 'N/A')
                    }
                  </td>
                  <td className="py-4 px-4 font-semibold">
                    {transfer.type === 'sent' ? (
                      <span className="text-red-500">-{formatCurrency(transfer.amount || 0, 'INR')}</span>
                    ) : (
                      <span className="text-green-500">+{formatCurrency(transfer.amount || 0, 'INR')}</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-400">
                    {transfer.type === 'sent' && transfer.feeAmount ? (
                      <span className="text-red-500">-{formatCurrency(transfer.feeAmount, 'INR')}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`capitalize ${getStatusColor(transfer.status)}`}>
                      {transfer.status || 'N/A'}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-400">
                    {transfer.note || '-'}
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

