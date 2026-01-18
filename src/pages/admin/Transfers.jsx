import { useState } from 'react'
import { useCollection } from '../../hooks/useFirestore'
import { query, where, orderBy } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { DollarSign, Search, Filter, Ban } from 'lucide-react'

export default function AdminTransfers() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const constraints = []
  if (statusFilter !== 'all') {
    constraints.push(where('status', '==', statusFilter))
  }
  constraints.push(orderBy('createdAt', 'desc'))

  const { data: transfers, loading } = useCollection('transfers', constraints)

  const filteredTransfers = transfers.filter(t => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      t.senderUid?.toLowerCase().includes(search) ||
      t.recipientUid?.toLowerCase().includes(search) ||
      t.recipientEmailSnapshot?.toLowerCase().includes(search) ||
      t.senderEmailSnapshot?.toLowerCase().includes(search) ||
      t.id?.toLowerCase().includes(search)
    )
  })

  const getStatusColor = (status) => {
    const colors = {
      initiated: 'text-yellow-500',
      completed: 'text-green-500',
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
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <DollarSign className="text-primary" size={32} />
        Transfer Management
      </h1>

      <div className="card mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Search className="text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by user ID, email, or transfer ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field flex-1"
          />
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400" size={20} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field"
            >
              <option value="all">All Status</option>
              <option value="initiated">Initiated</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-4 px-4 font-semibold">Transfer ID</th>
              <th className="text-left py-4 px-4 font-semibold">Sender</th>
              <th className="text-left py-4 px-4 font-semibold">Recipient</th>
              <th className="text-left py-4 px-4 font-semibold">Amount</th>
              <th className="text-left py-4 px-4 font-semibold">Fee</th>
              <th className="text-left py-4 px-4 font-semibold">Status</th>
              <th className="text-left py-4 px-4 font-semibold">Date</th>
              <th className="text-left py-4 px-4 font-semibold">Note</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransfers.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center py-8 text-gray-400">
                  No transfers found
                </td>
              </tr>
            ) : (
              filteredTransfers.map((transfer) => (
                <tr key={transfer.id} className="border-b border-gray-800 hover:bg-dark-lighter">
                  <td className="py-4 px-4 text-sm font-mono">{transfer.id?.substring(0, 12)}...</td>
                  <td className="py-4 px-4 text-sm">
                    <div>
                      <p className="font-mono text-xs">{transfer.senderUid?.substring(0, 8)}...</p>
                      <p className="text-gray-400 text-xs">{transfer.senderEmailSnapshot || 'N/A'}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm">
                    <div>
                      <p className="font-mono text-xs">{transfer.recipientUid?.substring(0, 8)}...</p>
                      <p className="text-gray-400 text-xs">{transfer.recipientEmailSnapshot || 'N/A'}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-semibold">
                    {formatCurrency(transfer.amount || 0, 'INR')}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-400">
                    {transfer.feeAmount ? formatCurrency(transfer.feeAmount, 'INR') : '-'}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`capitalize ${getStatusColor(transfer.status)}`}>
                      {transfer.status || 'N/A'}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-400">
                    {formatDate(transfer.createdAt)}
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

