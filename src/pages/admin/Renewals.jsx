import { useCollection } from '../../hooks/useFirestore'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { RefreshCw, Search, CheckCircle, XCircle, Clock } from 'lucide-react'
import { formatDate, formatCurrency } from '../../utils/helpers'
import { useState } from 'react'
import { getFunctions, httpsCallable } from 'firebase/functions'

export default function AdminRenewals() {
  const { data: renewals, loading } = useCollection('renewals', [])
  const { data: users } = useCollection('users', [])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const userMap = {}
  users.forEach(u => { userMap[u.id] = u })

  const filteredRenewals = renewals.filter(renewal => {
    const user = userMap[renewal.uid]
    const matchesSearch = !searchTerm || 
      user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      renewal.uid?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = !statusFilter || renewal.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const handleApprove = async (renewalId) => {
    try {
      await updateDoc(doc(db, 'renewals', renewalId), {
        status: 'approved',
        updatedAt: new Date()
      })
      toast.success('Renewal approved')
    } catch (error) {
      console.error('Error approving renewal:', error)
      toast.error('Error approving renewal')
    }
  }

  const handleReject = async (renewalId, reason) => {
    if (!reason || reason.trim() === '') {
      toast.error('Please provide a rejection reason')
      return
    }
    
    try {
      await updateDoc(doc(db, 'renewals', renewalId), {
        status: 'rejected',
        rejectionReason: reason,
        updatedAt: new Date()
      })
      toast.success('Renewal rejected')
    } catch (error) {
      console.error('Error rejecting renewal:', error)
      toast.error('Error rejecting renewal')
    }
  }

  const handleMarkCompleted = async (renewalId, paymentRef) => {
    try {
      const functions = getFunctions()
      const processRenewal = httpsCallable(functions, 'processRenewal')
      
      const renewal = renewals.find(r => r.id === renewalId)
      if (!renewal) {
        toast.error('Renewal not found')
        return
      }

      await processRenewal({
        targetUid: renewal.uid,
        renewalPlanId: renewal.renewalPlanId,
        renewalMethod: renewal.method,
        paymentReference: paymentRef || renewal.paymentReference,
        notes: renewal.note
      })

      toast.success('Renewal processed successfully')
    } catch (error) {
      console.error('Error processing renewal:', error)
      toast.error(error.message || 'Error processing renewal')
    }
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
        <RefreshCw className="text-primary" size={32} />
        Renewal Requests
        <span className="text-lg text-gray-400 font-normal ml-2">({filteredRenewals.length})</span>
      </h1>

      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 flex items-center gap-2">
            <Search className="text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by user name, email, or UID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field flex-1"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field"
          >
            <option value="">All Status</option>
            <option value="requested">Requested</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {filteredRenewals.length === 0 ? (
        <div className="card">
          <div className="text-center py-12">
            <RefreshCw className="text-gray-400 mx-auto mb-4" size={48} />
            <p className="text-gray-400 text-lg">No renewal requests found</p>
          </div>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-4 px-4 font-semibold">User</th>
                <th className="text-left py-4 px-4 font-semibold">Cycle</th>
                <th className="text-left py-4 px-4 font-semibold">Plan</th>
                <th className="text-left py-4 px-4 font-semibold">Amount</th>
                <th className="text-left py-4 px-4 font-semibold">Method</th>
                <th className="text-left py-4 px-4 font-semibold">Status</th>
                <th className="text-left py-4 px-4 font-semibold">Requested</th>
                <th className="text-left py-4 px-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRenewals.map((renewal) => {
                const user = userMap[renewal.uid]
                return (
                  <tr key={renewal.id} className="border-b border-gray-800 hover:bg-dark-lighter">
                    <td className="py-4 px-4">
                      <div>
                        <div className="font-semibold">{user?.name || 'N/A'}</div>
                        <div className="text-sm text-gray-400">{user?.email || renewal.uid}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="badge">Cycle {renewal.oldCycleNumber} → {renewal.newCycleNumber}</span>
                    </td>
                    <td className="py-4 px-4">{renewal.renewalPlanId || 'Same Plan'}</td>
                    <td className="py-4 px-4">{formatCurrency(renewal.renewalAmountInr || 0)}</td>
                    <td className="py-4 px-4">
                      <span className="badge">{renewal.method || 'N/A'}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`badge ${
                        renewal.status === 'completed' ? 'bg-green-500' :
                        renewal.status === 'rejected' ? 'bg-red-500' :
                        renewal.status === 'approved' ? 'bg-blue-500' :
                        'bg-yellow-500'
                      }`}>
                        {renewal.status || 'requested'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-400">
                      {renewal.createdAt ? formatDate(renewal.createdAt) : 'N/A'}
                    </td>
                    <td className="py-4 px-4">
                      {renewal.status === 'requested' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(renewal.id)}
                            className="btn-secondary text-xs flex items-center gap-1"
                          >
                            <CheckCircle size={14} />
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Enter rejection reason:')
                              if (reason) handleReject(renewal.id, reason)
                            }}
                            className="btn-secondary text-xs text-red-500 flex items-center gap-1"
                          >
                            <XCircle size={14} />
                            Reject
                          </button>
                        </div>
                      )}
                      {renewal.status === 'approved' && (
                        <button
                          onClick={() => {
                            const paymentRef = prompt('Enter payment reference (optional):')
                            handleMarkCompleted(renewal.id, paymentRef)
                          }}
                          className="btn-primary text-xs flex items-center gap-1"
                        >
                          <CheckCircle size={14} />
                          Mark Paid
                        </button>
                      )}
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

