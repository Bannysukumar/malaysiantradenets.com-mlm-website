import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useFirestore'
import { query, where, orderBy } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { History, Filter, UserPlus } from 'lucide-react'

export default function UserActivationHistory() {
  const { user } = useAuth()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const constraints = user?.uid ? [
    where('sponsorUid', '==', user.uid),
    orderBy('createdAt', 'desc')
  ] : []

  const { data: activations, loading } = useCollection('activations', constraints)

  const filteredActivations = activations.filter(activation => {
    if (dateFrom || dateTo) {
      const activationDate = activation.createdAt?.toDate ? activation.createdAt.toDate() : new Date(activation.createdAt)
      if (dateFrom && activationDate < new Date(dateFrom)) return false
      if (dateTo && activationDate > new Date(dateTo)) return false
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
        <History className="text-primary" size={32} />
        Activation History
      </h1>

      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="text-gray-400" size={20} />
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <th className="text-left py-4 px-4 font-semibold">Target User</th>
              <th className="text-left py-4 px-4 font-semibold">Package</th>
              <th className="text-left py-4 px-4 font-semibold">Amount</th>
              <th className="text-left py-4 px-4 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredActivations.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-8 text-gray-400">
                  No activations found
                </td>
              </tr>
            ) : (
              filteredActivations.map((activation) => (
                <tr key={activation.id} className="border-b border-gray-800 hover:bg-dark-lighter">
                  <td className="py-4 px-4 text-sm">
                    {formatDate(activation.createdAt)}
                  </td>
                  <td className="py-4 px-4 text-sm">
                    {maskEmail(activation.targetEmailSnapshot)}
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

