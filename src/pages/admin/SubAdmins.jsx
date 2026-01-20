import { useState, useMemo, useEffect } from 'react'
import { useCollection } from '../../hooks/useFirestore'
import { doc, updateDoc, setDoc, collection } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import toast from 'react-hot-toast'
import { 
  Users, Search, Plus, Download, UserCheck, UserX, 
  Save, Lock, Ban, Eye, Check, X, ChevronDown, ChevronRight,
  LayoutDashboard, FileText, Package, DollarSign, Wallet,
  ArrowUpCircle, FileCheck, TreePine, Settings
} from 'lucide-react'
import { formatDate } from '../../utils/helpers'
import { useAuth } from '../../contexts/AuthContext'

// Permission groups mapping
const PERMISSION_GROUPS = {
  dashboard: { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
  users: { label: 'Users', icon: Users, path: '/admin/users' },
  kyc: { label: 'KYC', icon: FileCheck, path: '/admin/kyc-management' },
  packages: { label: 'Packages', icon: Package, path: '/admin/packages' },
  packageRequests: { label: 'Package Requests', icon: Package, path: '/admin/activations' },
  withdrawals: { label: 'Withdrawals', icon: ArrowUpCircle, path: '/admin/withdrawals' },
  reports: { label: 'Reports', icon: DollarSign, path: '/admin/reports' },
  payoutReports: { label: 'Payout Reports', icon: DollarSign, path: '/admin/payout-reports' },
  levelTree: { label: 'Level Tree', icon: TreePine, path: '/admin/level-tree' },
  content: { label: 'Content Pages', icon: FileText, path: '/admin/content' }
}

// Permission actions
const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'approve', 'export']

export default function SubAdmins() {
  const { userData: currentAdmin, isSuperAdmin } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSubAdmin, setSelectedSubAdmin] = useState(null)
  const [activeTab, setActiveTab] = useState('profile')
  const [showAddModal, setShowAddModal] = useState(false)
  const [copiedField, setCopiedField] = useState(null)

  // Only superAdmin can access this page
  if (!isSuperAdmin) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">Access Denied</p>
          <p className="text-gray-400">Only Super Admins can manage sub-admins</p>
        </div>
      </div>
    )
  }

  // Fetch all admins (role === 'admin' or 'subAdmin')
  const { data: allAdmins, loading } = useCollection('users', [])
  
  const subAdmins = useMemo(() => {
    return allAdmins.filter(u => 
      u.role === 'admin' || u.role === 'subAdmin'
    ).filter(u => (u.uid || u.id) !== (currentAdmin?.uid || currentAdmin?.id)) // Exclude current admin
  }, [allAdmins, currentAdmin])

  // Filter sub-admins by search
  const filteredSubAdmins = useMemo(() => {
    if (!searchTerm) return subAdmins
    const searchLower = searchTerm.toLowerCase()
    return subAdmins.filter(admin => 
      admin.name?.toLowerCase().includes(searchLower) ||
      admin.email?.toLowerCase().includes(searchLower) ||
      admin.userId?.toLowerCase().includes(searchLower) ||
      admin.phone?.includes(searchTerm)
    )
  }, [subAdmins, searchTerm])

  // Select first sub-admin by default
  useMemo(() => {
    if (!selectedSubAdmin && filteredSubAdmins.length > 0) {
      setSelectedSubAdmin(filteredSubAdmins[0])
    }
  }, [filteredSubAdmins, selectedSubAdmin])

  const handleSelectSubAdmin = (admin) => {
    setSelectedSubAdmin(admin)
    setActiveTab('profile')
  }

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <div>
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="text-primary" size={32} />
          Sub Admins
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Add Sub Admin
          </button>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Sub Admin List */}
        <div className="card">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name, email, User ID, or mobile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>

          <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
            {filteredSubAdmins.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                {loading ? 'Loading...' : 'No sub-admins found'}
              </div>
            ) : (
              filteredSubAdmins.map((admin) => {
                const adminId = admin.uid || admin.id
                const selectedId = selectedSubAdmin?.uid || selectedSubAdmin?.id
                const isSelected = selectedId === adminId
                const isActive = admin.status === 'active' || admin.status === 'ACTIVE_INVESTOR' || admin.status === 'ACTIVE_LEADER'
                
                return (
                  <div
                    key={adminId}
                    onClick={() => handleSelectSubAdmin(admin)}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-gray-700 hover:bg-dark-lighter'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-white mb-1">{admin.name || 'N/A'}</div>
                        <div className="text-sm text-gray-400 mb-1">
                          {admin.userId && (
                            <span className="font-mono text-primary">{admin.userId}</span>
                          )}
                          {admin.email && (
                            <span className="ml-2">{admin.email}</span>
                          )}
                        </div>
                        {admin.phone && (
                          <div className="text-xs text-gray-500">{admin.phone}</div>
                        )}
                      </div>
                      <span className={`badge ${
                        isActive ? 'bg-green-500' : 'bg-red-500'
                      } text-xs`}>
                        {isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    {admin.updatedAt && (
                      <div className="text-xs text-gray-500 mt-2">
                        Last updated: {formatDate(admin.updatedAt)}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column - Details + Permissions */}
        {selectedSubAdmin ? (
          <div className="card">
            <SubAdminDetails
              subAdmin={selectedSubAdmin}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onUpdate={() => {
                // Refresh will happen automatically via useCollection
                toast.success('Sub-admin updated successfully')
              }}
            />
          </div>
        ) : (
          <div className="card">
            <div className="text-center py-12 text-gray-400">
              <Users className="mx-auto mb-4" size={48} />
              <p>Select a sub-admin to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Sub Admin Modal */}
      {showAddModal && (
        <AddSubAdminModal
          onClose={() => setShowAddModal(false)}
          onSuccess={(newAdmin) => {
            setShowAddModal(false)
            setSelectedSubAdmin(newAdmin)
            setActiveTab('permissions')
          }}
        />
      )}
    </div>
  )
}

// Sub Admin Details Component
function SubAdminDetails({ subAdmin, activeTab, setActiveTab, onUpdate }) {
  const [formData, setFormData] = useState({
    name: subAdmin.name || '',
    email: subAdmin.email || '',
    phone: subAdmin.phone || '',
    status: subAdmin.status || 'active'
  })
  const [permissions, setPermissions] = useState(subAdmin.permissions || {})
  const [expandedGroups, setExpandedGroups] = useState({})
  const [saving, setSaving] = useState(false)

  // Sync form data when subAdmin changes
  useEffect(() => {
    setFormData({
      name: subAdmin.name || '',
      email: subAdmin.email || '',
      phone: subAdmin.phone || '',
      status: subAdmin.status || 'active'
    })
    setPermissions(subAdmin.permissions || {})
  }, [subAdmin])

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }))
  }

  const togglePermission = (group, action) => {
    setPermissions(prev => ({
      ...prev,
      [group]: {
        ...prev[group],
        [action]: !prev[group]?.[action]
      }
    }))
  }

  const grantAll = () => {
    const allPerms = {}
    Object.keys(PERMISSION_GROUPS).forEach(group => {
      allPerms[group] = {}
      PERMISSION_ACTIONS.forEach(action => {
        allPerms[group][action] = true
      })
    })
    setPermissions(allPerms)
  }

  const revokeAll = () => {
    setPermissions({})
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const subAdminId = subAdmin.uid || subAdmin.id
      await updateDoc(doc(db, 'users', subAdminId), {
        ...formData,
        updatedAt: new Date()
      })
      onUpdate()
    } catch (error) {
      console.error('Error updating sub-admin:', error)
      toast.error('Failed to update sub-admin')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePermissions = async () => {
    setSaving(true)
    try {
      const subAdminId = subAdmin.uid || subAdmin.id
      await updateDoc(doc(db, 'users', subAdminId), {
        permissions,
        updatedAt: new Date()
      })
      onUpdate()
    } catch (error) {
      console.error('Error updating permissions:', error)
      toast.error('Failed to update permissions')
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    try {
      await sendPasswordResetEmail(getAuth(), subAdmin.email)
      toast.success('Password reset email sent!')
    } catch (error) {
      console.error('Error sending password reset:', error)
      toast.error('Failed to send password reset email')
    }
  }

  const handleToggleStatus = async () => {
    const newStatus = formData.status === 'active' || formData.status === 'ACTIVE_INVESTOR' || formData.status === 'ACTIVE_LEADER'
      ? 'disabled'
      : 'active'
    
    setSaving(true)
    try {
      const subAdminId = subAdmin.uid || subAdmin.id
      await updateDoc(doc(db, 'users', subAdminId), {
        status: newStatus,
        updatedAt: new Date()
      })
      setFormData(prev => ({ ...prev, status: newStatus }))
      onUpdate()
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === 'profile'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === 'permissions'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Permissions
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              readOnly
              className="input-field bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Mobile</label>
            <input
              type="tel"
              value={formData.phone || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Status</label>
            <div className="flex items-center gap-4">
              <span className={`badge ${
                formData.status === 'active' || formData.status === 'ACTIVE_INVESTOR' || formData.status === 'ACTIVE_LEADER'
                  ? 'bg-green-500'
                  : 'bg-red-500'
              }`}>
                {formData.status === 'active' || formData.status === 'ACTIVE_INVESTOR' || formData.status === 'ACTIVE_LEADER' ? 'Active' : 'Disabled'}
              </span>
              <button
                onClick={handleToggleStatus}
                className="btn-secondary text-sm"
                disabled={saving}
              >
                {formData.status === 'active' || formData.status === 'ACTIVE_INVESTOR' || formData.status === 'ACTIVE_LEADER' ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>

          {subAdmin.createdAt && (
            <div>
              <label className="block text-sm font-semibold mb-2">Created Date</label>
              <p className="text-gray-400">{formatDate(subAdmin.createdAt)}</p>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t border-gray-700">
            <button
              onClick={handleResetPassword}
              className="btn-secondary flex items-center gap-2"
            >
              <Lock size={16} />
              Reset Password
            </button>
            <button
              onClick={handleSaveProfile}
              className="btn-primary flex items-center gap-2"
              disabled={saving}
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Permissions Tab */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-4">
            <button
              onClick={grantAll}
              className="btn-secondary text-sm"
            >
              Grant All
            </button>
            <button
              onClick={revokeAll}
              className="btn-secondary text-sm"
            >
              Revoke All
            </button>
          </div>

          <div className="space-y-2">
            {Object.entries(PERMISSION_GROUPS).map(([key, group]) => {
              const groupPerms = permissions[key] || {}
              const hasAnyPermission = PERMISSION_ACTIONS.some(action => groupPerms[action])
              const isExpanded = expandedGroups[key]

              return (
                <div key={key} className="border border-gray-700 rounded-lg">
                  <button
                    onClick={() => toggleGroup(key)}
                    className="w-full flex items-center justify-between p-4 hover:bg-dark-lighter transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <group.icon size={20} className="text-primary" />
                      <span className="font-semibold">{group.label}</span>
                      {hasAnyPermission && (
                        <span className="badge bg-green-500 text-xs">Active</span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronDown size={20} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={20} className="text-gray-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-4 border-t border-gray-700 bg-dark-lighter">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {PERMISSION_ACTIONS.filter(action => {
                          // For reports, show view and export
                          if (key === 'reports') {
                            return action === 'view' || action === 'export'
                          }
                          // For payoutReports, show view, export, create, viewProof
                          if (key === 'payoutReports') {
                            return action === 'view' || action === 'export' || action === 'create' || action === 'viewProof'
                          }
                          // For others, show all except export/viewProof (unless reports/payoutReports)
                          return action !== 'export' && action !== 'viewProof' || key === 'reports' || key === 'payoutReports'
                        }).map(action => {
                          const isEnabled = groupPerms[action] || false
                          return (
                            <label
                              key={action}
                              className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-dark transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={() => togglePermission(key, action)}
                                className="w-4 h-4 text-primary rounded"
                              />
                              <span className="text-sm capitalize">{action}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="pt-4 border-t border-gray-700">
            <button
              onClick={handleSavePermissions}
              className="btn-primary flex items-center gap-2"
              disabled={saving}
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Permissions'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Add Sub Admin Modal
function AddSubAdminModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    status: 'active',
    permissionPreset: 'custom'
  })
  const [permissions, setPermissions] = useState({})
  const [creating, setCreating] = useState(false)

  const permissionPresets = {
    readonly: {
      dashboard: { view: true },
      users: { view: true },
      kyc: { view: true },
      packages: { view: true },
      withdrawals: { view: true },
      reports: { view: true },
      levelTree: { view: true },
      content: { view: true }
    },
    support: {
      dashboard: { view: true },
      users: { view: true, edit: true },
      kyc: { view: true, approve: true },
      packages: { view: true },
      levelTree: { view: true }
    },
    finance: {
      dashboard: { view: true },
      withdrawals: { view: true, approve: true },
      reports: { view: true, create: true },
      users: { view: true }
    },
    custom: {}
  }

  const handlePresetChange = (preset) => {
    setFormData(prev => ({ ...prev, permissionPreset: preset }))
    if (preset !== 'custom') {
      setPermissions(permissionPresets[preset])
    }
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, password }))
  }

  const handleCreate = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Please fill in all required fields')
      return
    }

    setCreating(true)
    try {
      const auth = getAuth()
      
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      )

      // Create user document in Firestore
      const userDoc = {
        uid: userCredential.user.uid,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || '',
        role: 'subAdmin',
        status: formData.status,
        permissions: formData.permissionPreset === 'custom' ? permissions : permissionPresets[formData.permissionPreset],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await setDoc(doc(db, 'users', userCredential.user.uid), userDoc)

      toast.success('Sub-admin created successfully!')
      onSuccess(userDoc)
    } catch (error) {
      console.error('Error creating sub-admin:', error)
      toast.error(error.message || 'Failed to create sub-admin')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-light border border-gray-700 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Add Sub Admin</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Full Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Mobile</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Temporary Password *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="input-field flex-1"
                required
              />
              <button
                onClick={generatePassword}
                className="btn-secondary"
                type="button"
              >
                Generate
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              className="input-field"
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Permissions Preset</label>
            <select
              value={formData.permissionPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="input-field"
            >
              <option value="readonly">Read-only</option>
              <option value="support">Support (KYC + Users view)</option>
              <option value="finance">Finance (Withdrawals + Reports)</option>
              <option value="custom">Custom (manual selection)</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={creating}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="btn-primary flex-1"
            disabled={creating}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

