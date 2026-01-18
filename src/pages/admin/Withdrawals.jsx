import { useState } from 'react'
import { useCollection } from '../../hooks/useFirestore'
import { doc, updateDoc, query, where } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { DollarSign, Search, CheckCircle, XCircle, Clock, Filter } from 'lucide-react'
import { formatCurrency, formatDate } from '../../utils/helpers'
import { format } from 'date-fns'

export default function AdminWithdrawals() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null)
  const [adminNote, setAdminNote] = useState('')
  const [txRef, setTxRef] = useState('')

  const constraints = []
  if (statusFilter !== 'all') {
    constraints.push(where('status', '==', statusFilter))
  }

  const { data: withdrawals, loading } = useCollection('withdrawals', constraints)

  const filteredWithdrawals = withdrawals.filter(w => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      w.uid?.toLowerCase().includes(search) ||
      w.withdrawalId?.toLowerCase().includes(search) ||
      w.payoutDetailsSnapshot?.accountNumberMasked?.toLowerCase().includes(search) ||
      w.payoutDetailsSnapshot?.upiId?.toLowerCase().includes(search)
    )
  })

  const handleApprove = async (withdrawalId) => {
    try {
      await updateDoc(doc(db, 'withdrawals', withdrawalId), {
        status: 'approved',
        adminNote: adminNote || 'Approved by admin',
        updatedAt: new Date(),
        approvedAt: new Date(),
        approvedBy: 'admin' // Should be actual admin UID
      })
      toast.success('Withdrawal approved')
      setSelectedWithdrawal(null)
      setAdminNote('')
    } catch (error) {
      console.error('Approve error:', error)
      toast.error('Error approving withdrawal')
    }
  }

  const handleReject = async (withdrawalId) => {
    if (!adminNote.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }
    try {
      await updateDoc(doc(db, 'withdrawals', withdrawalId), {
        status: 'rejected',
        adminNote: adminNote,
        updatedAt: new Date(),
        rejectedAt: new Date(),
        rejectedBy: 'admin'
      })
      
      // Refund amount to user wallet (via Cloud Function)
      toast.success('Withdrawal rejected and amount refunded')
      setSelectedWithdrawal(null)
      setAdminNote('')
    } catch (error) {
      console.error('Reject error:', error)
      toast.error('Error rejecting withdrawal')
    }
  }

  const handleMarkPaid = async (withdrawalId) => {
    if (!txRef.trim()) {
      toast.error('Please provide transaction reference')
      return
    }
    try {
      await updateDoc(doc(db, 'withdrawals', withdrawalId), {
        status: 'paid',
        paidTxRef: txRef,
        paidAt: new Date(),
        updatedAt: new Date()
      })
      toast.success('Withdrawal marked as paid')
      setSelectedWithdrawal(null)
      setTxRef('')
    } catch (error) {
      console.error('Mark paid error:', error)
      toast.error('Error marking withdrawal as paid')
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      requested: 'text-yellow-500',
      under_review: 'text-blue-500',
      approved: 'text-green-500',
      paid: 'text-primary',
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
        Withdrawal Management
      </h1>

      <div className="card mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Search className="text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by user ID, withdrawal ID, account number, or UPI..."
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
              <option value="requested">Requested</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-4 px-4 font-semibold">User ID</th>
              <th className="text-left py-4 px-4 font-semibold">Amount</th>
              <th className="text-left py-4 px-4 font-semibold">Method</th>
              <th className="text-left py-4 px-4 font-semibold">Payout Details</th>
              <th className="text-left py-4 px-4 font-semibold">Status</th>
              <th className="text-left py-4 px-4 font-semibold">Requested</th>
              <th className="text-left py-4 px-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredWithdrawals.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-8 text-gray-400">
                  No withdrawals found
                </td>
              </tr>
            ) : (
              filteredWithdrawals.map((withdrawal) => (
                <tr key={withdrawal.id} className="border-b border-gray-800 hover:bg-dark-lighter">
                  <td className="py-4 px-4 text-sm font-mono">{withdrawal.uid?.substring(0, 8)}...</td>
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-semibold">{formatCurrency(withdrawal.netAmount || 0, 'INR')}</p>
                      <p className="text-xs text-gray-400">
                        Fee: {formatCurrency(withdrawal.feeAmount || 0, 'INR')}
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-4 capitalize">{withdrawal.method || 'N/A'}</td>
                  <td className="py-4 px-4 text-sm">
                    {withdrawal.method === 'bank' ? (
                      <div>
                        <p>{withdrawal.payoutDetailsSnapshot?.accountNumberMasked || 'N/A'}</p>
                        <p className="text-gray-400">{withdrawal.payoutDetailsSnapshot?.ifsc || ''}</p>
                      </div>
                    ) : (
                      <p>{withdrawal.payoutDetailsSnapshot?.upiId || 'N/A'}</p>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`capitalize ${getStatusColor(withdrawal.status)}`}>
                      {withdrawal.status || 'N/A'}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-400">
                    {formatDate(withdrawal.createdAt)}
                  </td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() => setSelectedWithdrawal(withdrawal)}
                      className="text-primary hover:underline text-sm"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedWithdrawal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Withdrawal Details</h2>
              <button
                onClick={() => {
                  setSelectedWithdrawal(null)
                  setAdminNote('')
                  setTxRef('')
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm text-gray-400">Withdrawal ID</p>
                <p className="font-mono">{selectedWithdrawal.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Amount Requested</p>
                <p className="text-2xl font-bold">{formatCurrency(selectedWithdrawal.amountRequested || 0, 'INR')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Admin Charges</p>
                <p className="text-red-500">{formatCurrency(selectedWithdrawal.feeAmount || 0, 'INR')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Net Amount</p>
                <p className="text-xl font-semibold text-primary">{formatCurrency(selectedWithdrawal.netAmount || 0, 'INR')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Method</p>
                <p className="capitalize">{selectedWithdrawal.method}</p>
              </div>
              {selectedWithdrawal.method === 'bank' && (
                <div>
                  <p className="text-sm text-gray-400">Bank Details</p>
                  <p>Account: {selectedWithdrawal.payoutDetailsSnapshot?.accountNumberMasked || 'N/A'}</p>
                  <p>IFSC: {selectedWithdrawal.payoutDetailsSnapshot?.ifsc || 'N/A'}</p>
                  <p>Holder: {selectedWithdrawal.payoutDetailsSnapshot?.holderName || 'N/A'}</p>
                </div>
              )}
              {selectedWithdrawal.method === 'upi' && (
                <div>
                  <p className="text-sm text-gray-400">UPI ID</p>
                  <p>{selectedWithdrawal.payoutDetailsSnapshot?.upiId || 'N/A'}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-400">Status</p>
                <p className={`capitalize ${getStatusColor(selectedWithdrawal.status)}`}>
                  {selectedWithdrawal.status}
                </p>
              </div>
              {selectedWithdrawal.adminNote && (
                <div>
                  <p className="text-sm text-gray-400">Admin Note</p>
                  <p>{selectedWithdrawal.adminNote}</p>
                </div>
              )}
            </div>

            {selectedWithdrawal.status === 'requested' || selectedWithdrawal.status === 'under_review' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Admin Note</label>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    className="input-field min-h-[100px]"
                    placeholder="Add notes or reason for rejection..."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleApprove(selectedWithdrawal.id)}
                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={20} />
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(selectedWithdrawal.id)}
                    className="flex-1 btn-secondary flex items-center justify-center gap-2"
                  >
                    <XCircle size={20} />
                    Reject
                  </button>
                </div>
              </div>
            ) : selectedWithdrawal.status === 'approved' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Transaction Reference</label>
                  <input
                    type="text"
                    value={txRef}
                    onChange={(e) => setTxRef(e.target.value)}
                    className="input-field"
                    placeholder="Enter payment transaction reference"
                  />
                </div>
                <button
                  onClick={() => handleMarkPaid(selectedWithdrawal.id)}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  <CheckCircle size={20} />
                  Mark as Paid
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

