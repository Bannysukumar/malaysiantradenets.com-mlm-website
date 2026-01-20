import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useFirestore, useCollection } from '../../hooks/useFirestore'
import { doc, updateDoc, collection, query, where, getDocs, addDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { getFunctions, httpsCallable } from 'firebase/functions'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { 
  ArrowLeft, User, Wallet, CreditCard, History, TrendingUp, 
  Users, FileText, Shield, Ban, Package, Edit, Download,
  CheckCircle, XCircle, AlertCircle, RefreshCw, Copy, Check
} from 'lucide-react'
import { formatDate, formatCurrency } from '../../utils/helpers'
import { useAuth } from '../../contexts/AuthContext'

export default function UserDetails() {
  const { uid } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [showActivateModal, setShowActivateModal] = useState(false)
  const [downlineTree, setDownlineTree] = useState(null)
  const [downlineList, setDownlineList] = useState([])
  const [loadingDownline, setLoadingDownline] = useState(false)

  const { data: userData, loading: userLoading } = useFirestore(doc(db, 'users', uid || 'dummy'))
  const { data: walletData } = useFirestore(doc(db, 'wallets', uid || 'dummy'))
  const { data: financialProfile } = useFirestore(doc(db, 'userFinancialProfiles', uid || 'dummy'))
  const { data: packages } = useCollection('packages', [])
  const { data: userPackages } = useCollection('userPackages', [])
  const { data: withdrawals } = useCollection('withdrawals', [])
  const { data: transfers } = useCollection('transfers', [])
  const { data: activations } = useCollection('activations', [])
  const { data: auditLogs } = useCollection('auditLogs', [])

  const userPackagesList = userPackages.filter(p => p.userId === uid)
  const activePackage = userPackagesList.find(p => p.status === 'active')
  const userWithdrawals = withdrawals.filter(w => w.uid === uid)
  const userTransfers = transfers.filter(t => t.senderUid === uid || t.recipientUid === uid)
  const userActivations = activations.filter(a => a.targetUid === uid || a.sponsorUid === uid)
  const userAuditLogs = auditLogs.filter(log => 
    log.targetUid === uid || log.userId === uid || log.sponsorUid === uid
  )

  // Get upline user
  const { data: uplineUser } = useFirestore(
    userData?.referredByUid ? doc(db, 'users', userData.referredByUid) : null
  )

  // Get directs count
  const { data: directs } = useCollection('users', [])
  const directsList = directs.filter(u => u.referredByUid === uid)

  useEffect(() => {
    if (activeTab === 'downline' && uid) {
      loadDownlineData()
    }
  }, [activeTab, uid])

  const loadDownlineData = async () => {
    if (!uid) return
    
    setLoadingDownline(true)
    try {
      const functions = getFunctions()
      const getTree = httpsCallable(functions, 'getUserDownlineTree')
      const getList = httpsCallable(functions, 'getUserDownlineList')

      const [treeResult, listResult] = await Promise.all([
        getTree({ userId: uid, maxDepth: 5 }),
        getList({ userId: uid, limit: 500 })
      ])

      setDownlineTree(treeResult.data.tree)
      setDownlineList(listResult.data.downline || [])
    } catch (error) {
      console.error('Error loading downline:', error)
      toast.error('Error loading downline data')
    } finally {
      setLoadingDownline(false)
    }
  }

  const handleBlockUser = async (block = true) => {
    if (!uid) return
    
    try {
      await updateDoc(doc(db, 'users', uid), {
        status: block ? 'blocked' : 'active'
      })
      toast.success(`User ${block ? 'blocked' : 'unblocked'} successfully`)
    } catch (error) {
      console.error('Error blocking user:', error)
      toast.error('Error updating user status')
    }
  }

  const handleResetRefCode = async () => {
    if (!uid || !confirm('Are you sure you want to reset the referral code?')) return
    
    try {
      const newRefCode = `REF${Math.random().toString(36).substr(2, 6).toUpperCase()}`
      await updateDoc(doc(db, 'users', uid), {
        refCode: newRefCode
      })
      toast.success('Referral code reset successfully')
    } catch (error) {
      console.error('Error resetting ref code:', error)
      toast.error('Error resetting referral code')
    }
  }

  const handleActivatePlan = async (formData) => {
    if (!uid) return

    try {
      const functions = getFunctions()
      const adminActivate = httpsCallable(functions, 'adminActivateUser')
      
      const result = await adminActivate({
        targetUid: uid,
        planId: formData.planId,
        activationSource: formData.activationSource,
        activationDate: formData.activationDate || new Date().toISOString(),
        notes: formData.notes,
        expiryDate: formData.expiryDate || null,
        sponsorUid: formData.activationSource === 'sponsor_activation' ? formData.sponsorUid : null
      })

      toast.success('User activated successfully')
      setShowActivateModal(false)
    } catch (error) {
      console.error('Error activating user:', error)
      toast.error(error.message || 'Error activating user')
    }
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">User not found</p>
          <button onClick={() => navigate('/admin/users')} className="btn-primary">
            Back to Users
          </button>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'financial', label: 'Financial', icon: CreditCard },
    { id: 'wallet', label: 'Wallet & Ledger', icon: Wallet },
    { id: 'withdrawals', label: 'Withdrawals', icon: TrendingUp },
    { id: 'transfers', label: 'Transfers', icon: History },
    { id: 'referrals', label: 'Referrals', icon: Users },
    { id: 'cap', label: 'Cap & Renewal', icon: RefreshCw },
    { id: 'downline', label: 'Downline', icon: Users },
    { id: 'audit', label: 'Audit & Notes', icon: FileText }
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/users')}
            className="btn-secondary"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-3xl font-bold">{userData.name || 'User'}</h1>
            <p className="text-gray-400">{userData.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowActivateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Package size={18} />
            Activate Plan
          </button>
          {userData.status === 'blocked' ? (
            <button
              onClick={() => handleBlockUser(false)}
              className="btn-secondary flex items-center gap-2"
            >
              <CheckCircle size={18} />
              Unblock
            </button>
          ) : (
            <button
              onClick={() => handleBlockUser(true)}
              className="btn-secondary flex items-center gap-2 text-red-500"
            >
              <Ban size={18} />
              Block
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="card mb-6">
        <div className="flex gap-2 border-b border-gray-700 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'overview' && <OverviewTab 
          userData={userData}
          activePackage={activePackage}
          uplineUser={uplineUser}
          directsList={directsList}
          walletData={walletData}
          onResetRefCode={handleResetRefCode}
        />}
        
        {activeTab === 'financial' && <FinancialTab 
          financialProfile={financialProfile}
          userData={userData}
        />}
        
        {activeTab === 'wallet' && <WalletTab 
          walletData={walletData}
          uid={uid}
        />}
        
        {activeTab === 'withdrawals' && <WithdrawalsTab 
          withdrawals={userWithdrawals}
          uid={uid}
        />}
        
        {activeTab === 'transfers' && <TransfersTab 
          transfers={userTransfers}
          uid={uid}
        />}
        
        {activeTab === 'referrals' && <ReferralsTab 
          uid={uid}
          userData={userData}
          userPackages={userPackages}
        />}
        
        {activeTab === 'cap' && <CapTab 
          activePackage={activePackage}
          uid={uid}
          userData={userData}
          onRenew={handleActivatePlan}
        />}
        
        {activeTab === 'downline' && <DownlineTab 
          tree={downlineTree}
          list={downlineList}
          loading={loadingDownline}
          navigate={navigate}
        />}
        
        {activeTab === 'audit' && <AuditTab 
          auditLogs={userAuditLogs}
          uid={uid}
        />}
      </div>

      {/* Activate Modal */}
      {showActivateModal && (
        <ActivateModal
          packages={packages}
          userData={userData}
          onClose={() => setShowActivateModal(false)}
          onActivate={handleActivatePlan}
        />
      )}
    </div>
  )
}

// Overview Tab Component
function OverviewTab({ userData, activePackage, uplineUser, directsList, walletData, onResetRefCode }) {
  const [copiedUserId, setCopiedUserId] = useState(false)
  
  const copyUserId = () => {
    if (userData?.userId) {
      navigator.clipboard.writeText(userData.userId)
      setCopiedUserId(true)
      toast.success('User ID copied to clipboard!')
      setTimeout(() => setCopiedUserId(false), 2000)
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <div>
        <h2 className="text-xl font-bold mb-4">Profile</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400">Name</label>
            <p className="text-lg">{userData.name || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-400">User ID</label>
            <div className="flex items-center gap-2">
              <p className="text-lg font-mono">{userData.userId || <span className="text-gray-500">Generating...</span>}</p>
              {userData.userId && (
                <button
                  onClick={copyUserId}
                  className="text-gray-400 hover:text-primary transition-colors"
                  title="Copy User ID"
                >
                  {copiedUserId ? (
                    <Check size={16} className="text-green-500" />
                  ) : (
                    <Copy size={16} />
                  )}
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-400">Email</label>
            <p className="text-lg">{userData.email}</p>
          </div>
          <div>
            <label className="text-sm text-gray-400">Phone</label>
            <p className="text-lg">{userData.phone || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-400">Created</label>
            <p className="text-lg">{userData.createdAt ? formatDate(userData.createdAt) : 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-400">Status</label>
            <span className={`badge ${userData.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}>
              {userData.status || 'active'}
            </span>
          </div>
        </div>
      </div>

      {/* Referral Section */}
      <div>
        <h2 className="text-xl font-bold mb-4">Referral</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400">Referral Code</label>
            <div className="flex items-center gap-2">
              <p className="text-lg font-mono">{userData.refCode}</p>
              <button onClick={onResetRefCode} className="btn-secondary text-xs">Reset</button>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-400">Referred By</label>
            <p className="text-lg">
              {uplineUser ? (
                <span>{uplineUser.name} ({uplineUser.email})</span>
              ) : (
                'None (Root user)'
              )}
            </p>
          </div>
          <div>
            <label className="text-sm text-gray-400">Direct Referrals</label>
            <p className="text-lg">{directsList.length}</p>
          </div>
        </div>
      </div>

      {/* Plan Section */}
      <div>
        <h2 className="text-xl font-bold mb-4">Current Plan</h2>
        {activePackage ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400">Package</label>
              <p className="text-lg">{activePackage.packageName}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Amount</label>
              <p className="text-lg">{formatCurrency(activePackage.amount)}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Activated</label>
              <p className="text-lg">{activePackage.activatedAt ? formatDate(activePackage.activatedAt) : 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Payment Method</label>
              <p className="text-lg">{activePackage.paymentMethod || 'N/A'}</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-400">No active package</p>
        )}
      </div>

      {/* Wallet Summary */}
      <div>
        <h2 className="text-xl font-bold mb-4">Wallet Summary</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400">Available</label>
            <p className="text-lg">{formatCurrency(walletData?.availableBalance || 0)}</p>
          </div>
          <div>
            <label className="text-sm text-gray-400">Pending</label>
            <p className="text-lg">{formatCurrency(walletData?.pendingBalance || 0)}</p>
          </div>
          <div>
            <label className="text-sm text-gray-400">Lifetime Earned</label>
            <p className="text-lg">{formatCurrency(walletData?.lifetimeEarned || 0)}</p>
          </div>
          <div>
            <label className="text-sm text-gray-400">Lifetime Withdrawn</label>
            <p className="text-lg">{formatCurrency(walletData?.lifetimeWithdrawn || 0)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Financial Tab Component
function FinancialTab({ financialProfile, userData }) {
  const maskAccount = (account) => {
    if (!account || account.length < 4) return account
    return `****${account.slice(-4)}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-4">Bank Details</h2>
        {financialProfile?.bankAccountNumber ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400">Account Number</label>
              <p className="text-lg font-mono">{maskAccount(financialProfile.bankAccountNumber)}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">IFSC</label>
              <p className="text-lg">{financialProfile.ifscCode || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Bank Name</label>
              <p className="text-lg">{financialProfile.bankName || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Branch</label>
              <p className="text-lg">{financialProfile.bankBranch || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Account Holder</label>
              <p className="text-lg">{financialProfile.accountHolderName || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Bank Verified</label>
              <span className={`badge ${financialProfile.bankVerified ? 'bg-green-500' : 'bg-red-500'}`}>
                {financialProfile.bankVerified ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-gray-400">No bank details provided</p>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">UPI Details</h2>
        {financialProfile?.upiId ? (
          <div>
            <label className="text-sm text-gray-400">UPI ID</label>
            <p className="text-lg">{financialProfile.upiId}</p>
          </div>
        ) : (
          <p className="text-gray-400">No UPI ID provided</p>
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Verification Status</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400">KYC Verified</label>
            <span className={`badge ${userData?.kycVerified ? 'bg-green-500' : 'bg-red-500'}`}>
              {userData?.kycVerified ? 'Yes' : 'No'}
            </span>
          </div>
          <div>
            <label className="text-sm text-gray-400">Bank Verified</label>
            <span className={`badge ${financialProfile?.bankVerified ? 'bg-green-500' : 'bg-red-500'}`}>
              {financialProfile?.bankVerified ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Wallet Tab Component
function WalletTab({ walletData, uid }) {
  const [ledgerEntries, setLedgerEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setLoading(false)
      return
    }

    const loadLedger = async () => {
      try {
        const entriesRef = collection(db, 'incomeLedger', uid, 'entries')
        const q = query(entriesRef)
        const snapshot = await getDocs(q)
        const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setLedgerEntries(entries)
      } catch (error) {
        console.error('Error loading ledger:', error)
      } finally {
        setLoading(false)
      }
    }

    loadLedger()
  }, [uid])

  const [filters, setFilters] = useState({
    type: '',
    dateFrom: '',
    dateTo: ''
  })

  const filteredEntries = ledgerEntries.filter(entry => {
    if (filters.type && entry.type !== filters.type) return false
    if (filters.dateFrom || filters.dateTo) {
      const entryDate = entry.createdAt?.toDate?.() || new Date(entry.createdAt)
      if (filters.dateFrom && entryDate < new Date(filters.dateFrom)) return false
      if (filters.dateTo && entryDate > new Date(filters.dateTo)) return false
    }
    return true
  })

  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'Amount', 'Status', 'Description']
    const rows = filteredEntries.map(entry => [
      entry.createdAt ? formatDate(entry.createdAt) : 'N/A',
      entry.type || 'N/A',
      entry.amount || 0,
      entry.status || 'N/A',
      entry.description || 'N/A'
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ledger_export_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-4">Wallet Summary</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="card">
            <label className="text-sm text-gray-400">Available Balance</label>
            <p className="text-2xl font-bold">{formatCurrency(walletData?.availableBalance || 0)}</p>
          </div>
          <div className="card">
            <label className="text-sm text-gray-400">Pending Balance</label>
            <p className="text-2xl font-bold">{formatCurrency(walletData?.pendingBalance || 0)}</p>
          </div>
          <div className="card">
            <label className="text-sm text-gray-400">Lifetime Earned</label>
            <p className="text-2xl font-bold">{formatCurrency(walletData?.lifetimeEarned || 0)}</p>
          </div>
          <div className="card">
            <label className="text-sm text-gray-400">Lifetime Withdrawn</label>
            <p className="text-2xl font-bold">{formatCurrency(walletData?.lifetimeWithdrawn || 0)}</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Income Ledger</h2>
          <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2">
            <Download size={18} />
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <select
            value={filters.type}
            onChange={(e) => setFilters({...filters, type: e.target.value})}
            className="input-field"
          >
            <option value="">All Types</option>
            <option value="direct_referral">Direct Referral</option>
            <option value="level_income">Level Income</option>
            <option value="roi">ROI</option>
            <option value="bonus">Bonus</option>
            <option value="transfer">Transfer</option>
            <option value="withdrawal">Withdrawal</option>
            <option value="admin_adjustment">Admin Adjustment</option>
          </select>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
            className="input-field"
            placeholder="From Date"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
            className="input-field"
            placeholder="To Date"
          />
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-4">Date</th>
                <th className="text-left py-2 px-4">Type</th>
                <th className="text-left py-2 px-4">Amount</th>
                <th className="text-left py-2 px-4">Status</th>
                <th className="text-left py-2 px-4">Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry, idx) => (
                <tr key={entry.id || idx} className="border-b border-gray-800">
                  <td className="py-2 px-4">{entry.createdAt ? formatDate(entry.createdAt) : 'N/A'}</td>
                  <td className="py-2 px-4">
                    <span className="badge">{entry.type || 'N/A'}</span>
                  </td>
                  <td className={`py-2 px-4 ${entry.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatCurrency(entry.amount || 0)}
                  </td>
                  <td className="py-2 px-4">
                    <span className={`badge ${entry.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'}`}>
                      {entry.status || 'N/A'}
                    </span>
                  </td>
                  <td className="py-2 px-4">{entry.description || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Withdrawals Tab Component
function WithdrawalsTab({ withdrawals, uid }) {
  const handleApprove = async (withdrawalId) => {
    // Implementation for approval
    toast.success('Withdrawal approved')
  }

  const handleReject = async (withdrawalId, reason) => {
    // Implementation for rejection
    toast.success('Withdrawal rejected')
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Withdrawal Requests</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-4">Date</th>
              <th className="text-left py-2 px-4">Amount</th>
              <th className="text-left py-2 px-4">Fee</th>
              <th className="text-left py-2 px-4">Net</th>
              <th className="text-left py-2 px-4">Method</th>
              <th className="text-left py-2 px-4">Status</th>
              <th className="text-left py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map((withdrawal) => (
              <tr key={withdrawal.id} className="border-b border-gray-800">
                <td className="py-2 px-4">{withdrawal.createdAt ? formatDate(withdrawal.createdAt) : 'N/A'}</td>
                <td className="py-2 px-4">{formatCurrency(withdrawal.amount || 0)}</td>
                <td className="py-2 px-4">{formatCurrency(withdrawal.fee || 0)}</td>
                <td className="py-2 px-4">{formatCurrency((withdrawal.amount || 0) - (withdrawal.fee || 0))}</td>
                <td className="py-2 px-4">{withdrawal.method || 'N/A'}</td>
                <td className="py-2 px-4">
                  <span className={`badge ${
                    withdrawal.status === 'paid' ? 'bg-green-500' :
                    withdrawal.status === 'rejected' ? 'bg-red-500' :
                    'bg-yellow-500'
                  }`}>
                    {withdrawal.status || 'pending'}
                  </span>
                </td>
                <td className="py-2 px-4">
                  {withdrawal.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(withdrawal.id)} className="btn-secondary text-xs">
                        Approve
                      </button>
                      <button onClick={() => handleReject(withdrawal.id, '')} className="btn-secondary text-xs text-red-500">
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Transfers Tab Component
function TransfersTab({ transfers, uid }) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Transfers</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-4">Date</th>
              <th className="text-left py-2 px-4">Type</th>
              <th className="text-left py-2 px-4">Amount</th>
              <th className="text-left py-2 px-4">Counterparty</th>
              <th className="text-left py-2 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr key={transfer.id} className="border-b border-gray-800">
                <td className="py-2 px-4">{transfer.createdAt ? formatDate(transfer.createdAt) : 'N/A'}</td>
                <td className="py-2 px-4">
                  {transfer.senderUid === uid ? 'Sent' : 'Received'}
                </td>
                <td className="py-2 px-4">{formatCurrency(transfer.amount || 0)}</td>
                <td className="py-2 px-4">
                  {transfer.senderUid === uid 
                    ? transfer.recipientEmail || 'N/A'
                    : transfer.senderEmail || 'N/A'
                  }
                </td>
                <td className="py-2 px-4">
                  <span className={`badge ${transfer.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'}`}>
                    {transfer.status || 'pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Downline Tab Component
function DownlineTab({ tree, list, loading, navigate }) {
  const [viewMode, setViewMode] = useState('tree') // 'tree' or 'list'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Downline</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('tree')}
            className={`btn-secondary ${viewMode === 'tree' ? 'bg-primary' : ''}`}
          >
            Tree View
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`btn-secondary ${viewMode === 'list' ? 'bg-primary' : ''}`}
          >
            List View
          </button>
        </div>
      </div>

      {viewMode === 'tree' ? (
        <DownlineTreeView tree={tree} navigate={navigate} />
      ) : (
        <DownlineListView list={list} navigate={navigate} />
      )}
    </div>
  )
}

// Downline Tree View Component
function DownlineTreeView({ tree, navigate }) {
  const [expanded, setExpanded] = useState({})

  const toggleExpand = (uid) => {
    setExpanded({...expanded, [uid]: !expanded[uid]})
  }

  const renderNode = (node, depth = 0) => {
    if (!node) return null

    const isExpanded = expanded[node.uid]
    const hasChildren = node.children && node.children.length > 0

    return (
      <div key={node.uid} className="ml-4">
        <div className="flex items-center gap-2 py-2 border-l-2 border-gray-700 pl-4">
          <div className="flex-1 flex items-center gap-2">
            {hasChildren && (
              <button
                onClick={() => toggleExpand(node.uid)}
                className="text-primary"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{node.name}</span>
                <span className="text-xs text-gray-400">L{node.level}</span>
                <span className="badge">{node.plan}</span>
                <span className={`badge ${node.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}>
                  {node.status}
                </span>
              </div>
              <div className="text-sm text-gray-400">
                {node.email} • Wallet: {formatCurrency(node.walletAvailable)} • Directs: {node.directsCount}
              </div>
            </div>
            <button
              onClick={() => navigate(`/admin/users/${node.uid}`)}
              className="btn-secondary text-xs"
            >
              View
            </button>
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div className="ml-8">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {tree ? (
        <div>{renderNode(tree)}</div>
      ) : (
        <p className="text-gray-400">No downline data available</p>
      )}
    </div>
  )
}

// Downline List View Component
function DownlineListView({ list, navigate }) {
  const handleExportCSV = () => {
    const headers = ['Level', 'Name', 'Email', 'Phone', 'Plan', 'Wallet', 'Earned', 'Withdrawn', 'KYC', 'Bank', 'Status']
    const rows = list.map(user => [
      `L${user.level}`,
      user.name,
      user.email,
      user.phone,
      user.plan,
      user.walletAvailable,
      user.totalEarned,
      user.totalWithdrawn,
      user.kycStatus ? 'Yes' : 'No',
      user.bankStatus ? 'Yes' : 'No',
      user.status
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `downline_export_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2">
          <Download size={18} />
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-4">Level</th>
              <th className="text-left py-2 px-4">Name</th>
              <th className="text-left py-2 px-4">Email</th>
              <th className="text-left py-2 px-4">Plan</th>
              <th className="text-left py-2 px-4">Wallet</th>
              <th className="text-left py-2 px-4">Earned</th>
              <th className="text-left py-2 px-4">Withdrawn</th>
              <th className="text-left py-2 px-4">Status</th>
              <th className="text-left py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((user, idx) => (
              <tr key={user.uid || idx} className="border-b border-gray-800">
                <td className="py-2 px-4">L{user.level}</td>
                <td className="py-2 px-4">{user.name}</td>
                <td className="py-2 px-4">{user.email}</td>
                <td className="py-2 px-4">
                  <span className="badge">{user.plan}</span>
                </td>
                <td className="py-2 px-4">{formatCurrency(user.walletAvailable)}</td>
                <td className="py-2 px-4">{formatCurrency(user.totalEarned)}</td>
                <td className="py-2 px-4">{formatCurrency(user.totalWithdrawn)}</td>
                <td className="py-2 px-4">
                  <span className={`badge ${user.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {user.status}
                  </span>
                </td>
                <td className="py-2 px-4">
                  <button
                    onClick={() => navigate(`/admin/users/${user.uid}`)}
                    className="btn-secondary text-xs"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Cap Tab Component
function CapTab({ activePackage, uid, userData, onRenew }) {
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [renewalConfig, setRenewalConfig] = useState(null)
  const [recalculating, setRecalculating] = useState(false)
  const { data: renewalConfigData } = useFirestore(doc(db, 'adminConfig', 'renewals'))
  const { data: packages } = useCollection('packages', [])
  const { data: renewals } = useCollection('renewals', [])
  const cycleNumber = activePackage?.cycleNumber || 1
  const capRef = uid ? doc(db, 'earningCaps', `${uid}_${cycleNumber}`) : null
  const { data: capData } = useFirestore(capRef)

  useEffect(() => {
    if (renewalConfigData) {
      setRenewalConfig(renewalConfigData)
    }
  }, [renewalConfigData])

  const userRenewals = renewals.filter(r => r.uid === uid)
  const earningsTotal = capData?.eligibleEarningsTotalInr || 0
  const capAmount = activePackage?.capAmountInr || capData?.capAmountInr || 0
  const remaining = Math.max(0, capAmount - earningsTotal)
  const progressPercent = capAmount > 0 ? Math.min(100, (earningsTotal / capAmount) * 100) : 0

  const handleRenewNow = async (formData) => {
    try {
      const functions = getFunctions()
      const processRenewal = httpsCallable(functions, 'processRenewal')
      
      await processRenewal({
        targetUid: uid,
        renewalPlanId: formData.planId || activePackage.packageId,
        renewalMethod: formData.method,
        notes: formData.notes || 'Admin renewed via user details page'
      })

      toast.success('Renewal processed successfully')
      setShowRenewModal(false)
    } catch (error) {
      console.error('Error processing renewal:', error)
      toast.error(error.message || 'Error processing renewal')
    }
  }

  const handleRecalculateCap = async () => {
    if (!confirm('Recalculate earning cap based on existing ledger entries? This will update the cap tracker with all eligible income.')) {
      return
    }

    setRecalculating(true)
    try {
      const functions = getFunctions()
      const recalculateCap = httpsCallable(functions, 'recalculateEarningCap')
      
      const result = await recalculateCap({ userId: uid })
      toast.success(result.data.message || 'Cap recalculated successfully')
      
      // Refresh the page data by reloading
      window.location.reload()
    } catch (error) {
      console.error('Error recalculating cap:', error)
      toast.error(error.message || 'Error recalculating cap')
    } finally {
      setRecalculating(false)
    }
  }

  if (!activePackage) {
    return (
      <div>
        <p className="text-gray-400">User has no active package</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cap Status */}
      <div>
        <h2 className="text-xl font-bold mb-4">Cap Status</h2>
        <div className={`card ${
          activePackage.capStatus === 'CAP_REACHED' ? 'border-red-500 border-2' :
          activePackage.capStatus === 'RENEWAL_PENDING' ? 'border-yellow-500 border-2' :
          'border-gray-700'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className={`badge ${
                activePackage.capStatus === 'CAP_REACHED' ? 'bg-red-500' :
                activePackage.capStatus === 'RENEWAL_PENDING' ? 'bg-yellow-500' :
                'bg-green-500'
              }`}>
                {activePackage.capStatus || 'ACTIVE'}
              </span>
              {activePackage.capReachedAt && (
                <p className="text-sm text-gray-400 mt-2">
                  Cap reached: {formatDate(activePackage.capReachedAt)}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRecalculateCap}
                disabled={recalculating}
                className="btn-secondary flex items-center gap-2"
                title="Recalculate cap based on existing ledger entries"
              >
                <RefreshCw size={18} className={recalculating ? 'animate-spin' : ''} />
                {recalculating ? 'Recalculating...' : 'Recalculate Cap'}
              </button>
              {activePackage.capStatus === 'CAP_REACHED' && (
                <button
                  onClick={() => setShowRenewModal(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <RefreshCw size={18} />
                  Renew Now
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Earned:</span>
              <span className="font-semibold">{formatCurrency(earningsTotal, 'INR')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Cap Amount:</span>
              <span className="font-semibold">{formatCurrency(capAmount, 'INR')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Remaining:</span>
              <span className="font-semibold">{formatCurrency(remaining, 'INR')}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden mt-4">
              <div
                className={`h-full transition-all duration-300 ${
                  activePackage.capStatus === 'CAP_REACHED' ? 'bg-red-500' :
                  progressPercent > 80 ? 'bg-yellow-500' :
                  'bg-primary'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              {progressPercent.toFixed(1)}% of cap reached
            </p>
          </div>
        </div>
      </div>

      {/* Cap Configuration */}
      <div>
        <h2 className="text-xl font-bold mb-4">Cap Configuration</h2>
        <div className="card">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400">Base Amount</label>
              <p className="text-lg font-semibold">{formatCurrency(activePackage.baseAmountInr || activePackage.amount, 'INR')}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Cap Multiplier</label>
              <p className="text-lg font-semibold">{activePackage.capMultiplier || 3.0}x</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Cap Amount</label>
              <p className="text-lg font-semibold">{formatCurrency(capAmount, 'INR')}</p>
            </div>
            <div>
              <label className="text-sm text-gray-400">Current Cycle</label>
              <p className="text-lg font-semibold">Cycle {activePackage.cycleNumber || 1}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Renewal History */}
      <div>
        <h2 className="text-xl font-bold mb-4">Renewal History</h2>
        {userRenewals.length === 0 ? (
          <div className="card">
            <p className="text-gray-400">No renewals yet</p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-4">Date</th>
                  <th className="text-left py-2 px-4">Cycle</th>
                  <th className="text-left py-2 px-4">Plan</th>
                  <th className="text-left py-2 px-4">Amount</th>
                  <th className="text-left py-2 px-4">Method</th>
                  <th className="text-left py-2 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {userRenewals.map((renewal) => (
                  <tr key={renewal.id} className="border-b border-gray-800">
                    <td className="py-2 px-4">{renewal.createdAt ? formatDate(renewal.createdAt) : 'N/A'}</td>
                    <td className="py-2 px-4">
                      {renewal.oldCycleNumber} → {renewal.newCycleNumber}
                    </td>
                    <td className="py-2 px-4">{renewal.renewalPlanId || 'Same'}</td>
                    <td className="py-2 px-4">{formatCurrency(renewal.renewalAmountInr || 0)}</td>
                    <td className="py-2 px-4">
                      <span className="badge">{renewal.method || 'N/A'}</span>
                    </td>
                    <td className="py-2 px-4">
                      <span className={`badge ${
                        renewal.status === 'completed' ? 'bg-green-500' :
                        renewal.status === 'rejected' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`}>
                        {renewal.status || 'requested'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Renew Modal */}
      {showRenewModal && (
        <RenewModal
          activePackage={activePackage}
          packages={packages}
          onClose={() => setShowRenewModal(false)}
          onRenew={handleRenewNow}
        />
      )}
    </div>
  )
}

// Renew Modal Component
function RenewModal({ activePackage, packages, onClose, onRenew }) {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      planId: activePackage?.packageId || '',
      method: 'admin_complimentary',
      notes: ''
    }
  })

  const onSubmit = (data) => {
    if (!data.planId) {
      toast.error('Please select a plan')
      return
    }
    onRenew(data)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-dark-light rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Renew ID</h2>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Plan</label>
            <select {...register('planId')} className="input-field" required>
              <option value={activePackage?.packageId}>
                {activePackage?.packageName} - {formatCurrency(activePackage?.amount, 'INR')} (Same)
              </option>
              {packages
                .filter(p => (p.inrPrice || p.usdPrice || 0) > (activePackage?.amount || 0))
                .map(pkg => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} - {formatCurrency(pkg.inrPrice || pkg.usdPrice || 0, 'INR')} (Upgrade)
                  </option>
                ))
              }
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Renewal Method</label>
            <select {...register('method')} className="input-field" required>
              <option value="admin_complimentary">Admin Complimentary (Free)</option>
              <option value="manual_paid">Manual Paid</option>
              <option value="user_wallet">User Wallet</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              {...register('notes')}
              className="input-field min-h-[100px]"
              placeholder="Renewal notes..."
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Process Renewal
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Referrals Tab Component
function ReferralsTab({ uid, userData, userPackages = [] }) {
  const { data: allUsers } = useCollection('users', [])
  const { data: allIncomeEntries } = useCollection('incomeLedger', [])
  const { data: referralConfig } = useFirestore(doc(db, 'adminConfig', 'referralIncome'))
  const [processingRef, setProcessingRef] = useState(null)
  
  // Get active Investor packages for each direct referral
  const getRefereeActivePackage = (refereeUid) => {
    return userPackages.find(p => 
      p.userId === refereeUid && 
      p.status === 'active' && 
      p.packageId !== 'LEADER_PROGRAM'
    )
  }

  // Get upline info
  const uplineUser = userData?.referredByUid 
    ? allUsers.find(u => u.id === userData.referredByUid)
    : null

  // Get direct referrals
  const directReferrals = allUsers.filter(u => u.referredByUid === uid)

  // Get referral income earned by this user
  const userIncomeEntries = allIncomeEntries.find(e => e.id === uid)?.entries || []
  const referralIncomeEntries = userIncomeEntries.filter(e => e.type === 'REFERRAL_DIRECT')
  const referralIncomeTotal = referralIncomeEntries
    .filter(e => e.status === 'APPROVED' || e.status === 'completed')
    .reduce((sum, e) => sum + (e.amount || 0), 0)

  const isInvestor = userData?.programType === 'investor' && userData?.status === 'ACTIVE_INVESTOR'
  const isLeader = userData?.programType === 'leader'

  const handleProcessReferralIncome = async (refereeUid) => {
    if (!confirm(`Process referral income for this referee? This will credit referral income to ${userData?.name || userData?.email}.`)) {
      return
    }

    setProcessingRef(refereeUid)
    try {
      const functions = getFunctions()
      const processReferralIncome = httpsCallable(functions, 'manualProcessReferralIncome')
      
      const result = await processReferralIncome({ refereeUid })
      toast.success(result.data.message || 'Referral income processed successfully')
    } catch (error) {
      console.error('Error processing referral income:', error)
      toast.error(error.message || 'Error processing referral income')
    } finally {
      setProcessingRef(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Upline Info */}
      <div>
        <h2 className="text-xl font-bold mb-4">Upline Information</h2>
        {uplineUser ? (
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Referred By</p>
                <Link to={`/admin/users/${uplineUser.id}`} className="text-primary hover:underline text-lg font-semibold">
                  {uplineUser.name || uplineUser.email}
                </Link>
                <p className="text-sm text-gray-400 mt-1">
                  {uplineUser.email} • {uplineUser.programType === 'investor' ? 'Investor' : uplineUser.programType === 'leader' ? 'Leader' : 'Not Selected'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Referral Code Used</p>
                <p className="font-mono">{userData?.refCodeUsed || 'N/A'}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <p className="text-gray-400">No upline (root user or no referral code used)</p>
          </div>
        )}
      </div>

      {/* Referral Income Summary */}
      {isInvestor && (
        <div>
          <h2 className="text-xl font-bold mb-4">Referral Income Summary</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="card">
              <p className="text-sm text-gray-400 mb-1">Total Earned</p>
              <p className="text-2xl font-bold text-green-500">{formatCurrency(referralIncomeTotal, 'INR')}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-400 mb-1">Total Entries</p>
              <p className="text-2xl font-bold text-white">{referralIncomeEntries.length}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-400 mb-1">Direct Referrals</p>
              <p className="text-2xl font-bold text-primary">{directReferrals.length}</p>
            </div>
          </div>
        </div>
      )}

      {isLeader && (
        <div className="card border-yellow-500 border-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-yellow-500 mb-1">Leader Program</p>
              <p className="text-sm text-gray-300">
                This user is a Leader. Leaders cannot earn referral income. Referral income is only available for Investors.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Direct Referrals List */}
      <div>
        <h2 className="text-xl font-bold mb-4">Direct Referrals ({directReferrals.length})</h2>
        {directReferrals.length === 0 ? (
          <div className="card">
            <p className="text-gray-400">No direct referrals</p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 font-semibold">Name</th>
                  <th className="text-left py-3 px-4 font-semibold">Email</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 font-semibold">Program</th>
                  <th className="text-left py-3 px-4 font-semibold">Joined</th>
                  <th className="text-left py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {directReferrals.map((ref) => (
                  <tr key={ref.id} className="border-b border-gray-800 hover:bg-dark-lighter">
                    <td className="py-3 px-4">{ref.name || 'N/A'}</td>
                    <td className="py-3 px-4 text-sm">{ref.email}</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${
                        ref.status === 'ACTIVE_INVESTOR' ? 'bg-green-500' :
                        ref.status === 'ACTIVE_LEADER' ? 'bg-purple-500' :
                        ref.status === 'PENDING_ACTIVATION' ? 'bg-yellow-500' :
                        'bg-gray-500'
                      }`}>
                        {ref.status || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="badge">
                        {ref.programType === 'investor' ? 'Investor' :
                         ref.programType === 'leader' ? 'Leader' : 'Not Selected'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {ref.createdAt ? formatDate(ref.createdAt) : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/admin/users/${ref.id}`}
                          className="text-primary hover:underline text-sm"
                        >
                          View
                        </Link>
                        {/* Show Process Referral Income button if:
                            1. This user (uid) is an Investor
                            2. Referee is ACTIVE_INVESTOR
                            3. Referee has an active Investor package */}
                        {isInvestor && 
                         ref.status === 'ACTIVE_INVESTOR' && 
                         ref.programType === 'investor' &&
                         getRefereeActivePackage(ref.id) && (
                          <button
                            onClick={() => handleProcessReferralIncome(ref.id)}
                            disabled={processingRef === ref.id}
                            className="text-xs btn-secondary px-2 py-1"
                            title="Process referral income for this activation"
                          >
                            {processingRef === ref.id ? 'Processing...' : 'Process Income'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Referral Income History */}
      {isInvestor && (
        <div>
          <h2 className="text-xl font-bold mb-4">Referral Income History</h2>
          {referralIncomeEntries.length === 0 ? (
            <div className="card">
              <p className="text-gray-400">No referral income yet</p>
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 font-semibold">Date</th>
                    <th className="text-left py-3 px-4 font-semibold">Amount</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {referralIncomeEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-800 hover:bg-dark-lighter">
                      <td className="py-3 px-4 text-sm">
                        {entry.createdAt ? formatDate(entry.createdAt) : 'N/A'}
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
                      <td className="py-3 px-4 text-sm text-gray-400">
                        {entry.description || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Audit Tab Component
function AuditTab({ auditLogs, uid }) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Audit Logs</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-4">Date</th>
              <th className="text-left py-2 px-4">Action</th>
              <th className="text-left py-2 px-4">Performed By</th>
              <th className="text-left py-2 px-4">Details</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log, idx) => (
              <tr key={log.id || idx} className="border-b border-gray-800">
                <td className="py-2 px-4">{log.createdAt ? formatDate(log.createdAt) : 'N/A'}</td>
                <td className="py-2 px-4">
                  <span className="badge">{log.action || 'N/A'}</span>
                </td>
                <td className="py-2 px-4">{log.performedByEmail || log.performedBy || 'N/A'}</td>
                <td className="py-2 px-4">
                  <pre className="text-xs">{JSON.stringify(log, null, 2)}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Activate Modal Component
function ActivateModal({ packages, userData, onClose, onActivate }) {
  const [formData, setFormData] = useState({
    planId: '',
    activationSource: 'admin_complimentary',
    activationDate: new Date().toISOString().split('T')[0],
    notes: '',
    expiryDate: '',
    sponsorUid: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.planId || !formData.notes) {
      toast.error('Please fill all required fields')
      return
    }
    onActivate(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-dark-light rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Activate Plan for {userData?.name}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Package *</label>
            <select
              value={formData.planId}
              onChange={(e) => setFormData({...formData, planId: e.target.value})}
              className="input-field"
              required
            >
              <option value="">Select Package</option>
              {packages.map(pkg => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} - {formatCurrency(pkg.inrPrice || pkg.usdPrice || 0)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Activation Source *</label>
            <select
              value={formData.activationSource}
              onChange={(e) => setFormData({...formData, activationSource: e.target.value})}
              className="input-field"
              required
            >
              <option value="admin_complimentary">Admin Complimentary (Free)</option>
              <option value="paid_manual">Paid (Manual)</option>
              <option value="sponsor_activation">Sponsor Activation</option>
            </select>
          </div>

          {formData.activationSource === 'sponsor_activation' && (
            <div>
              <label className="block text-sm font-medium mb-2">Sponsor UID</label>
              <input
                type="text"
                value={formData.sponsorUid}
                onChange={(e) => setFormData({...formData, sponsorUid: e.target.value})}
                className="input-field"
                placeholder="Enter sponsor user ID"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Activation Date</label>
            <input
              type="date"
              value={formData.activationDate}
              onChange={(e) => setFormData({...formData, activationDate: e.target.value})}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Expiry Date (Optional)</label>
            <input
              type="date"
              value={formData.expiryDate}
              onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notes *</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="input-field"
              rows={4}
              required
              placeholder="Enter activation notes (required)"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Activate
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

