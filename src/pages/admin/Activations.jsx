import { useState } from 'react'
import { useCollection } from '../../hooks/useFirestore'
import { query, where, orderBy } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { Users, Search, Filter } from 'lucide-react'

export default function AdminActivations() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const constraints = []
  if (statusFilter !== 'all') {
    constraints.push(where('status', '==', statusFilter))
  }
  constraints.push(orderBy('createdAt', 'desc'))

  const { data: activations, loading } = useCollection('activations', constraints)

  const filteredActivations = activations.filter(a => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      a.sponsorUid?.toLowerCase().includes(search) ||
      a.targetUid?.toLowerCase().includes(search) ||
      a.targetEmailSnapshot?.toLowerCase().includes(search) ||
      a.planId?.toLowerCase().includes(search) ||
      a.id?.toLowerCase().includes(search)
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
        <Users className="text-primary" size={32} />
        Activation Management
      </h1>

      <div className="card mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Search className="text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by user ID, email, plan ID, or activation ID..."
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
              <th className="text-left py-4 px-4 font-semibold">Activation ID</th>
              <th className="text-left py-4 px-4 font-semibold">Sponsor</th>
              <th className="text-left py-4 px-4 font-semibold">Target User</th>
              <th className="text-left py-4 px-4 font-semibold">Package</th>
              <th className="text-left py-4 px-4 font-semibold">Amount</th>
              <th className="text-left py-4 px-4 font-semibold">Status</th>
              <th className="text-left py-4 px-4 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredActivations.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-8 text-gray-400">
                  No activations found
                </td>
              </tr>
            ) : (
              filteredActivations.map((activation) => (
                <tr key={activation.id} className="border-b border-gray-800 hover:bg-dark-lighter">
                  <td className="py-4 px-4 text-sm font-mono">{activation.id?.substring(0, 12)}...</td>
                  <td className="py-4 px-4 text-sm">
                    <div>
                      <p className="font-mono text-xs">{activation.sponsorUid?.substring(0, 8)}...</p>
                      <p className="text-gray-400 text-xs">{activation.sponsorEmailSnapshot || 'N/A'}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm">
                    <div>
                      <p className="font-mono text-xs">{activation.targetUid?.substring(0, 8)}...</p>
                      <p className="text-gray-400 text-xs">{activation.targetEmailSnapshot || 'N/A'}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    {activation.planName || activation.planId || 'N/A'}
                  </td>
                  <td className="py-4 px-4 font-semibold text-primary">
                    {formatCurrency(activation.amount || 0, 'INR')}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`capitalize ${getStatusColor(activation.status)}`}>
                      {activation.status || 'N/A'}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-400">
                    {formatDate(activation.createdAt)}
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

