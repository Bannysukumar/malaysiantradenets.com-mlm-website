import { useState, useMemo, useEffect } from 'react'
import { useCollection } from '../../hooks/useFirestore'
import { doc, updateDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { 
  Building2, Search, Filter, CheckCircle, XCircle, Eye, Download, 
  Calendar, User, Mail, Phone, Hash, AlertCircle, CreditCard, Wallet
} from 'lucide-react'
import { formatDate, formatCurrency } from '../../utils/helpers'
import { useAuth } from '../../contexts/AuthContext'

export default function BankVerification() {
  const { user, userData } = useAuth()
  const { data: users, loading: usersLoading } = useCollection('users', [])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('')
  const [selectedBank, setSelectedBank] = useState(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [adminRemarks, setAdminRemarks] = useState('')
  const [processing, setProcessing] = useState(false)
  const [bankAccounts, setBankAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [reloadTrigger, setReloadTrigger] = useState(0)

  // Load all bank accounts from userFinancialProfiles
  useEffect(() => {
    const loadBankAccounts = async () => {
      if (users.length === 0) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const allBanks = []
        
        // Get all users
        for (const user of users) {
          const userId = user.uid || user.id
          if (!userId) continue

          try {
            // Check if user has banks subcollection (new structure)
            const banksRef = collection(db, 'userFinancialProfiles', userId, 'banks')
            const banksSnapshot = await getDocs(banksRef)
            
            if (!banksSnapshot.empty) {
              // New structure: multiple banks in subcollection
              banksSnapshot.forEach(bankDoc => {
                const bankData = bankDoc.data()
                allBanks.push({
                  id: bankDoc.id,
                  userId,
                  userName: user.name,
                  userEmail: user.email,
                  userPhone: user.phone,
                  userUserId: user.userId,
                  ...bankData,
                  source: 'subcollection'
                })
              })
            } else {
              // Fallback: check old structure (single bank in userFinancialProfiles)
              const financialProfileRef = doc(db, 'userFinancialProfiles', userId)
              const financialProfileDoc = await getDoc(financialProfileRef)
              
              if (financialProfileDoc.exists()) {
                const profileData = financialProfileDoc.data()
                
                if (profileData.bank && profileData.bank.holderName) {
                  allBanks.push({
                    id: `default_${userId}`,
                    userId,
                    userName: user.name,
                    userEmail: user.email,
                    userPhone: user.phone,
                    userUserId: user.userId,
                    paymentType: 'bank',
                    ...profileData.bank,
                    isVerified: profileData.bank.isVerified || false,
                    source: 'legacy'
                  })
                }
                
                if (profileData.upi && profileData.upi.upiId) {
                  allBanks.push({
                    id: `upi_${userId}`,
                    userId,
                    userName: user.name,
                    userEmail: user.email,
                    userPhone: user.phone,
                    userUserId: user.userId,
                    paymentType: 'upi',
                    upiId: profileData.upi.upiId,
                    upiName: profileData.upi.upiName || '',
                    isVerified: profileData.upi.isVerified || false,
                    source: 'legacy'
                  })
                }
              }
            }
          } catch (error) {
            // Skip if user doesn't have financial profile
            console.error(`Error loading banks for user ${userId}:`, error)
          }
        }
        
        setBankAccounts(allBanks)
      } catch (error) {
        console.error('Error loading bank accounts:', error)
        toast.error('Error loading bank accounts')
      } finally {
        setLoading(false)
      }
    }

    loadBankAccounts()
  }, [users, reloadTrigger])

  // Reload function
  const reloadBanks = () => {
    setReloadTrigger(prev => prev + 1)
  }

  // Filter bank accounts
  const filteredBanks = useMemo(() => {
    let filtered = bankAccounts

    if (statusFilter) {
      if (statusFilter === 'verified') {
        filtered = filtered.filter(bank => bank.isVerified === true)
      } else if (statusFilter === 'pending') {
        filtered = filtered.filter(bank => bank.isVerified !== true)
      } else if (statusFilter === 'unverified') {
        filtered = filtered.filter(bank => bank.isVerified === false)
      }
    }

    if (paymentTypeFilter) {
      filtered = filtered.filter(bank => bank.paymentType === paymentTypeFilter)
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(bank =>
        bank.userName?.toLowerCase().includes(searchLower) ||
        bank.userEmail?.toLowerCase().includes(searchLower) ||
        bank.userPhone?.includes(searchTerm) ||
        bank.userUserId?.toLowerCase().includes(searchLower) ||
        bank.holderName?.toLowerCase().includes(searchLower) ||
        bank.ifsc?.toLowerCase().includes(searchLower) ||
        bank.accountNumberLast4?.includes(searchTerm) ||
        bank.upiId?.toLowerCase().includes(searchLower)
      )
    }

    return filtered.sort((a, b) => {
      // Sort by verification status: unverified first, then by date
      if (!a.isVerified && b.isVerified) return -1
      if (a.isVerified && !b.isVerified) return 1
      const aDate = a.createdAt?.toDate?.() || a.updatedAt?.toDate?.() || new Date(0)
      const bDate = b.createdAt?.toDate?.() || b.updatedAt?.toDate?.() || new Date(0)
      return bDate - aDate
    })
  }, [bankAccounts, statusFilter, paymentTypeFilter, searchTerm])

  const handleViewDetails = (bank) => {
    setSelectedBank(bank)
    setAdminRemarks(bank.adminRemarks || '')
    setShowDetailsModal(true)
  }

  const handleApprove = async () => {
    if (!selectedBank) return
    if (!user?.uid) {
      toast.error('User authentication required')
      return
    }

    const adminUid = user.uid // Store after validation check
    setProcessing(true)
    try {
      if (selectedBank.source === 'subcollection') {
        // New structure: update in banks subcollection
        const bankRef = doc(db, 'userFinancialProfiles', selectedBank.userId, 'banks', selectedBank.id)
        await updateDoc(bankRef, {
          isVerified: true,
          verifiedAt: new Date(),
          verifiedBy: adminUid,
          adminRemarks: adminRemarks || null,
          updatedAt: new Date(),
        })
      } else {
        // Legacy structure: update in userFinancialProfiles
        const profileRef = doc(db, 'userFinancialProfiles', selectedBank.userId)
        const profileDoc = await getDoc(profileRef)
        
        if (profileDoc.exists()) {
          const profileData = profileDoc.data()
          const updateData = { updatedAt: new Date() }
          
          if (selectedBank.paymentType === 'bank' && profileData.bank) {
            updateData.bank = {
              ...profileData.bank,
              isVerified: true,
              verifiedAt: new Date(),
              verifiedBy: adminUid,
              adminRemarks: adminRemarks || null,
            }
          } else if (selectedBank.paymentType === 'upi' && profileData.upi) {
            updateData.upi = {
              ...profileData.upi,
              isVerified: true,
              verifiedAt: new Date(),
              verifiedBy: adminUid,
              adminRemarks: adminRemarks || null,
            }
          }
          
          await updateDoc(profileRef, updateData)
        }
      }

      // Update user's bankVerified status if this is the primary bank
      if (selectedBank.isPrimary !== false) {
        const userRef = doc(db, 'users', selectedBank.userId)
        await updateDoc(userRef, {
          bankVerified: true,
          updatedAt: new Date(),
        })
      }

      toast.success('Bank account verified successfully')
      setShowDetailsModal(false)
      setSelectedBank(null)
      setAdminRemarks('')
      reloadBanks() // Trigger reload
    } catch (error) {
      console.error('Error approving bank:', error)
      toast.error('Error verifying bank account')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedBank) return
    if (!user?.uid) {
      toast.error('User authentication required')
      return
    }

    if (!adminRemarks.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    const adminUid = user.uid // Store after validation check
    setProcessing(true)
    try {
      if (selectedBank.source === 'subcollection') {
        // New structure: update in banks subcollection
        const bankRef = doc(db, 'userFinancialProfiles', selectedBank.userId, 'banks', selectedBank.id)
        await updateDoc(bankRef, {
          isVerified: false,
          rejectedAt: new Date(),
          rejectedBy: adminUid,
          adminRemarks: adminRemarks,
          updatedAt: new Date(),
        })
      } else {
        // Legacy structure: update in userFinancialProfiles
        const profileRef = doc(db, 'userFinancialProfiles', selectedBank.userId)
        const profileDoc = await getDoc(profileRef)
        
        if (profileDoc.exists()) {
          const profileData = profileDoc.data()
          const updateData = { updatedAt: new Date() }
          
          if (selectedBank.paymentType === 'bank' && profileData.bank) {
            updateData.bank = {
              ...profileData.bank,
              isVerified: false,
              rejectedAt: new Date(),
              rejectedBy: adminUid,
              adminRemarks: adminRemarks,
            }
          } else if (selectedBank.paymentType === 'upi' && profileData.upi) {
            updateData.upi = {
              ...profileData.upi,
              isVerified: false,
              rejectedAt: new Date(),
              rejectedBy: adminUid,
              adminRemarks: adminRemarks,
            }
          }
          
          await updateDoc(profileRef, updateData)
        }
      }

      toast.success('Bank account rejected')
      setShowDetailsModal(false)
      setSelectedBank(null)
      setAdminRemarks('')
      reloadBanks() // Trigger reload
    } catch (error) {
      console.error('Error rejecting bank:', error)
      toast.error('Error rejecting bank account')
    } finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (isVerified) => {
    if (isVerified === true) {
      return <span className="badge bg-green-500">Verified</span>
    }
    return <span className="badge bg-yellow-500">Pending</span>
  }

  const getPaymentTypeBadge = (paymentType) => {
    if (paymentType === 'upi') {
      return <span className="badge bg-blue-500">UPI</span>
    }
    return <span className="badge bg-purple-500">Bank</span>
  }

  const pendingCount = useMemo(() => {
    return bankAccounts.filter(bank => bank.isVerified !== true).length
  }, [bankAccounts])

  if (usersLoading || loading) {
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
          <Building2 size={32} />
          Bank Account Verification
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
              placeholder="Search by name, email, phone, IFSC, UPI..."
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
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={paymentTypeFilter}
              onChange={(e) => setPaymentTypeFilter(e.target.value)}
              className="input-field w-40"
            >
              <option value="">All Types</option>
              <option value="bank">Bank Account</option>
              <option value="upi">UPI</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bank Accounts Table */}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-4 px-4 font-semibold">User</th>
              <th className="text-left py-4 px-4 font-semibold">User ID</th>
              <th className="text-left py-4 px-4 font-semibold">Payment Type</th>
              <th className="text-left py-4 px-4 font-semibold">Account Details</th>
              <th className="text-left py-4 px-4 font-semibold">Status</th>
              <th className="text-left py-4 px-4 font-semibold">Primary</th>
              <th className="text-left py-4 px-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBanks.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  No bank accounts found
                </td>
              </tr>
            ) : (
              filteredBanks.map((bank, index) => (
                <tr 
                  key={bank.id} 
                  className={`border-b border-gray-800 ${index % 2 === 0 ? 'bg-dark-lighter' : ''} hover:bg-dark-light`}
                >
                  <td className="py-4 px-4">
                    <div>
                      <div className="font-medium">{bank.userName || 'N/A'}</div>
                      <div className="text-sm text-gray-400">{bank.userEmail || ''}</div>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono text-sm">
                    {bank.userUserId || 'N/A'}
                  </td>
                  <td className="py-4 px-4">
                    {getPaymentTypeBadge(bank.paymentType)}
                  </td>
                  <td className="py-4 px-4">
                    {bank.paymentType === 'bank' ? (
                      <div className="text-sm">
                        <div><span className="text-gray-400">Holder:</span> {bank.holderName || 'N/A'}</div>
                        <div><span className="text-gray-400">Account:</span> <span className="font-mono">{bank.accountNumberMasked || `XXXXXX${bank.accountNumberLast4 || 'XXXX'}`}</span></div>
                        <div><span className="text-gray-400">IFSC:</span> <span className="font-mono">{bank.ifsc || 'N/A'}</span></div>
                        {bank.bankName && <div><span className="text-gray-400">Bank:</span> {bank.bankName}</div>}
                      </div>
                    ) : (
                      <div className="text-sm">
                        <div><span className="text-gray-400">UPI ID:</span> {bank.upiId || 'N/A'}</div>
                        {bank.upiName && <div><span className="text-gray-400">Name:</span> {bank.upiName}</div>}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    {getStatusBadge(bank.isVerified)}
                  </td>
                  <td className="py-4 px-4">
                    {bank.isPrimary ? (
                      <span className="badge bg-primary">Primary</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() => handleViewDetails(bank)}
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
      {showDetailsModal && selectedBank && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-light p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Building2 size={28} />
                Bank Account Details
              </h2>
              <button
                onClick={() => {
                  setShowDetailsModal(false)
                  setSelectedBank(null)
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
                  <div><span className="text-gray-400">Name:</span> {selectedBank.userName}</div>
                  <div><span className="text-gray-400">Email:</span> {selectedBank.userEmail}</div>
                  <div><span className="text-gray-400">Phone:</span> {selectedBank.userPhone || 'N/A'}</div>
                  <div><span className="text-gray-400">User ID:</span> <span className="font-mono">{selectedBank.userUserId}</span></div>
                </div>
              </div>

              <div className="p-4 bg-dark-lighter rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard size={18} className="text-primary" />
                  <span className="font-semibold">Account Information</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div><span className="text-gray-400">Type:</span> {getPaymentTypeBadge(selectedBank.paymentType)}</div>
                  <div><span className="text-gray-400">Status:</span> {getStatusBadge(selectedBank.isVerified)}</div>
                  <div><span className="text-gray-400">Primary:</span> {selectedBank.isPrimary ? 'Yes' : 'No'}</div>
                  {selectedBank.createdAt && (
                    <div><span className="text-gray-400">Created:</span> {formatDate(selectedBank.createdAt)}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Bank/UPI Details */}
            <div className="mb-6">
              <h3 className="font-semibold mb-4">Account Details</h3>
              {selectedBank.paymentType === 'bank' ? (
                <div className="p-4 bg-dark-lighter rounded-lg space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400">Account Holder Name</label>
                      <p className="font-medium">{selectedBank.holderName || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">Account Number</label>
                      <p className="font-mono">{selectedBank.accountNumberMasked || `XXXXXX${selectedBank.accountNumberLast4 || 'XXXX'}`}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">IFSC Code</label>
                      <p className="font-mono">{selectedBank.ifsc || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">Account Type</label>
                      <p className="capitalize">{selectedBank.accountType || 'N/A'}</p>
                    </div>
                    {selectedBank.bankName && (
                      <div>
                        <label className="text-sm text-gray-400">Bank Name</label>
                        <p>{selectedBank.bankName}</p>
                      </div>
                    )}
                    {selectedBank.branch && (
                      <div>
                        <label className="text-sm text-gray-400">Branch</label>
                        <p>{selectedBank.branch}</p>
                      </div>
                    )}
                    {selectedBank.city && (
                      <div>
                        <label className="text-sm text-gray-400">City</label>
                        <p>{selectedBank.city}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-dark-lighter rounded-lg space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400">UPI ID</label>
                      <p className="font-medium">{selectedBank.upiId || 'N/A'}</p>
                    </div>
                    {selectedBank.upiName && (
                      <div>
                        <label className="text-sm text-gray-400">UPI Name / Platform</label>
                        <p>{selectedBank.upiName}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Admin Remarks */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">
                Admin Remarks {selectedBank.isVerified === false && selectedBank.rejectedAt && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
                className="input-field w-full h-24"
                placeholder={selectedBank.isVerified === false && selectedBank.rejectedAt ? 'Required for rejection' : 'Optional remarks'}
                disabled={selectedBank.isVerified === true}
              />
              {selectedBank.adminRemarks && selectedBank.isVerified !== undefined && (
                <p className="text-sm text-gray-400 mt-1">
                  Previous remarks: {selectedBank.adminRemarks}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            {selectedBank.isVerified !== true && (
              <div className="flex gap-4">
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} />
                  {processing ? 'Processing...' : 'Verify Bank Account'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={processing}
                  className="btn-danger flex-1 flex items-center justify-center gap-2"
                >
                  <XCircle size={18} />
                  {processing ? 'Processing...' : 'Reject'}
                </button>
              </div>
            )}

            {selectedBank.isVerified === true && (
              <div className="p-4 bg-dark-lighter rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle size={16} className="text-green-500" />
                  <span className="text-gray-400">
                    This bank account has been verified.
                    {selectedBank.verifiedAt && (
                      <span> Verified on {formatDate(selectedBank.verifiedAt)}</span>
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

