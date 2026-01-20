import { useState, useMemo } from 'react'
import { useCollection } from '../../hooks/useFirestore'
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { 
  FileCheck, Search, Filter, CheckCircle, XCircle, Eye, Download, 
  Calendar, User, Mail, Phone, Hash, AlertCircle
} from 'lucide-react'
import { formatDate } from '../../utils/helpers'
import { useAuth } from '../../contexts/AuthContext'

export default function KYCManagement() {
  const { userData, isSuperAdmin } = useAuth()
  const { data: kycRequests, loading } = useCollection('kycRequests', [])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedKyc, setSelectedKyc] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [adminRemarks, setAdminRemarks] = useState('')
  const [processing, setProcessing] = useState(false)

  // Filter KYC requests
  const filteredRequests = useMemo(() => {
    let filtered = kycRequests || []

    if (statusFilter) {
      filtered = filtered.filter(req => req.status === statusFilter)
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(req =>
        req.userName?.toLowerCase().includes(searchLower) ||
        req.userEmail?.toLowerCase().includes(searchLower) ||
        req.panNumber?.toLowerCase().includes(searchLower) ||
        req.aadharNumber?.includes(searchTerm) ||
        req.userId?.toLowerCase().includes(searchLower)
      )
    }

    return filtered.sort((a, b) => {
      // Sort by status: pending first, then by date
      if (a.status === 'pending' && b.status !== 'pending') return -1
      if (a.status !== 'pending' && b.status === 'pending') return 1
      const aDate = a.submittedAt?.toDate?.() || new Date(0)
      const bDate = b.submittedAt?.toDate?.() || new Date(0)
      return bDate - aDate
    })
  }, [kycRequests, statusFilter, searchTerm])

  const handleViewDetails = (kyc) => {
    setSelectedKyc(kyc)
    setAdminRemarks(kyc.adminRemarks || '')
    setShowDetailsModal(true)
  }

  const handleApprove = async () => {
    if (!selectedKyc) return

    setProcessing(true)
    try {
      const kycRef = doc(db, 'kycRequests', selectedKyc.id)
      
      // Update KYC request status
      await updateDoc(kycRef, {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: userData.uid,
        adminRemarks: adminRemarks || null,
      })

      // Update user's kycVerified status
      const userRef = doc(db, 'users', selectedKyc.userId)
      await updateDoc(userRef, {
        kycVerified: true,
        updatedAt: new Date(),
      })

      toast.success('KYC approved successfully')
      setShowDetailsModal(false)
      setSelectedKyc(null)
      setAdminRemarks('')
    } catch (error) {
      console.error('Error approving KYC:', error)
      toast.error('Error approving KYC')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedKyc) return

    if (!adminRemarks.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    setProcessing(true)
    try {
      const kycRef = doc(db, 'kycRequests', selectedKyc.id)
      
      // Update KYC request status
      await updateDoc(kycRef, {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: userData.uid,
        adminRemarks: adminRemarks,
      })

      // Update user's kycVerified status to false
      const userRef = doc(db, 'users', selectedKyc.userId)
      await updateDoc(userRef, {
        kycVerified: false,
        updatedAt: new Date(),
      })

      toast.success('KYC rejected')
      setShowDetailsModal(false)
      setSelectedKyc(null)
      setAdminRemarks('')
    } catch (error) {
      console.error('Error rejecting KYC:', error)
      toast.error('Error rejecting KYC')
    } finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="badge bg-green-500">Approved</span>
      case 'rejected':
        return <span className="badge bg-red-500">Rejected</span>
      case 'pending':
        return <span className="badge bg-yellow-500">Pending</span>
      default:
        return <span className="badge bg-gray-500">{status || 'Unknown'}</span>
    }
  }

  const pendingCount = useMemo(() => {
    return (kycRequests || []).filter(req => req.status === 'pending').length
  }, [kycRequests])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileCheck size={32} />
          KYC Management
        </h1>
        {pendingCount > 0 && (
          <div className="badge bg-yellow-500 text-lg px-4 py-2">
            {pendingCount} Pending
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] max-w-sm flex items-center gap-2">
            <Search className="text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, email, PAN, Aadhar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400" size={20} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field w-40"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* KYC Requests Table */}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-4 px-4 font-semibold">Submitted Date</th>
              <th className="text-left py-4 px-4 font-semibold">User</th>
              <th className="text-left py-4 px-4 font-semibold">User ID</th>
              <th className="text-left py-4 px-4 font-semibold">PAN Number</th>
              <th className="text-left py-4 px-4 font-semibold">Aadhar Number</th>
              <th className="text-left py-4 px-4 font-semibold">Status</th>
              <th className="text-left py-4 px-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  No KYC requests found
                </td>
              </tr>
            ) : (
              filteredRequests.map((kyc, index) => (
                <tr 
                  key={kyc.id} 
                  className={`border-b border-gray-800 ${index % 2 === 0 ? 'bg-dark-lighter' : ''} hover:bg-dark-light`}
                >
                  <td className="py-4 px-4">
                    {kyc.submittedAt ? formatDate(kyc.submittedAt) : 'N/A'}
                  </td>
                  <td className="py-4 px-4">
                    <div>
                      <div className="font-medium">{kyc.userName || 'N/A'}</div>
                      <div className="text-sm text-gray-400">{kyc.userEmail || ''}</div>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono text-sm">
                    {kyc.userId || 'N/A'}
                  </td>
                  <td className="py-4 px-4 font-mono text-sm">
                    {kyc.panNumber || 'N/A'}
                  </td>
                  <td className="py-4 px-4">
                    {kyc.aadharNumber || '-'}
                  </td>
                  <td className="py-4 px-4">
                    {getStatusBadge(kyc.status)}
                  </td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() => handleViewDetails(kyc)}
                      className="btn-primary text-sm flex items-center gap-1"
                    >
                      <Eye size={16} />
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedKyc && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-light p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <FileCheck size={28} />
                KYC Request Details
              </h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false)
                  setSelectedKyc(null)
                  setAdminRemarks('')
                }}
                className="text-gray-400 hover:text-white"
              >
                <XCircle size={24} />
              </button>
            </div>

            {/* User Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-dark-lighter rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User size={18} className="text-primary" />
                  <span className="font-semibold">User Information</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div><span className="text-gray-400">Name:</span> {selectedKyc.userName}</div>
                  <div><span className="text-gray-400">Email:</span> {selectedKyc.userEmail}</div>
                  <div><span className="text-gray-400">User ID:</span> <span className="font-mono">{selectedKyc.userId}</span></div>
                </div>
              </div>

              <div className="p-4 bg-dark-lighter rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileCheck size={18} className="text-primary" />
                  <span className="font-semibold">KYC Information</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div><span className="text-gray-400">PAN:</span> <span className="font-mono">{selectedKyc.panNumber}</span></div>
                  <div><span className="text-gray-400">Aadhar:</span> {selectedKyc.aadharNumber || 'Not provided'}</div>
                  <div><span className="text-gray-400">Status:</span> {getStatusBadge(selectedKyc.status)}</div>
                  <div><span className="text-gray-400">Submitted:</span> {selectedKyc.submittedAt ? formatDate(selectedKyc.submittedAt) : 'N/A'}</div>
                </div>
              </div>
            </div>

            {/* Documents */}
            <div className="mb-6">
              <h3 className="font-semibold mb-4">Submitted Documents</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedKyc.documents?.panImage && (
                  <div className="p-4 bg-dark-lighter rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">PAN Image</span>
                      <a
                        href={selectedKyc.documents.panImage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-sm flex items-center gap-1"
                      >
                        <Download size={14} />
                        View
                      </a>
                    </div>
                    <img
                      src={selectedKyc.documents.panImage}
                      alt="PAN"
                      className="w-full h-48 object-contain rounded border border-gray-700"
                    />
                  </div>
                )}

                {selectedKyc.documents?.aadharFront && (
                  <div className="p-4 bg-dark-lighter rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Aadhar Front / ID Proof</span>
                      <a
                        href={selectedKyc.documents.aadharFront}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-sm flex items-center gap-1"
                      >
                        <Download size={14} />
                        View
                      </a>
                    </div>
                    <img
                      src={selectedKyc.documents.aadharFront}
                      alt="Aadhar Front"
                      className="w-full h-48 object-contain rounded border border-gray-700"
                    />
                  </div>
                )}

                {selectedKyc.documents?.aadharBack && (
                  <div className="p-4 bg-dark-lighter rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Aadhar Back</span>
                      <a
                        href={selectedKyc.documents.aadharBack}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-sm flex items-center gap-1"
                      >
                        <Download size={14} />
                        View
                      </a>
                    </div>
                    <img
                      src={selectedKyc.documents.aadharBack}
                      alt="Aadhar Back"
                      className="w-full h-48 object-contain rounded border border-gray-700"
                    />
                  </div>
                )}

                {selectedKyc.documents?.selfie && (
                  <div className="p-4 bg-dark-lighter rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Selfie</span>
                      <a
                        href={selectedKyc.documents.selfie}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-sm flex items-center gap-1"
                      >
                        <Download size={14} />
                        View
                      </a>
                    </div>
                    <img
                      src={selectedKyc.documents.selfie}
                      alt="Selfie"
                      className="w-full h-48 object-contain rounded border border-gray-700"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Admin Remarks */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Admin Remarks {selectedKyc.status === 'rejected' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
                className="input-field w-full h-24"
                placeholder={selectedKyc.status === 'rejected' ? 'Required for rejection' : 'Optional remarks'}
                disabled={selectedKyc.status === 'approved'}
              />
              {selectedKyc.adminRemarks && selectedKyc.status !== 'pending' && (
                <p className="text-sm text-gray-400 mt-1">
                  Previous remarks: {selectedKyc.adminRemarks}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            {selectedKyc.status === 'pending' && (
              <div className="flex gap-4">
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} />
                  {processing ? 'Processing...' : 'Approve KYC'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={processing}
                  className="btn-danger flex-1 flex items-center justify-center gap-2"
                >
                  <XCircle size={18} />
                  {processing ? 'Processing...' : 'Reject KYC'}
                </button>
              </div>
            )}

            {selectedKyc.status !== 'pending' && (
              <div className="p-4 bg-dark-lighter rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle size={16} className="text-gray-400" />
                  <span className="text-gray-400">
                    This KYC request has been {selectedKyc.status}.
                    {selectedKyc.status === 'approved' && selectedKyc.approvedAt && (
                      <span> Approved on {formatDate(selectedKyc.approvedAt)}</span>
                    )}
                    {selectedKyc.status === 'rejected' && selectedKyc.rejectedAt && (
                      <span> Rejected on {formatDate(selectedKyc.rejectedAt)}</span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

