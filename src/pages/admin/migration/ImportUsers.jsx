import { useState, useRef } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useCollection } from '../../../hooks/useFirestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import toast from 'react-hot-toast'
import { Upload, Plus, Trash2, Download, CheckCircle2, AlertCircle, FileText, Database } from 'lucide-react'
import Papa from 'papaparse'

export default function ImportUsers() {
  const { user } = useAuth()
  const { data: packages, loading: packagesLoading } = useCollection('packages', [])
  const [importMode, setImportMode] = useState('form') // 'form' or 'csv'
  const [users, setUsers] = useState([{
    userId: '',
    fullName: '',
    mobile: '',
    email: '',
    sponsorId: '',
    programType: 'investor',
    status: 'active',
    joinDate: '',
    activationDate: '',
    packageId: '',
    investAmount: '',
    packageName: '',
    tempPassword: '',
    bankAccountNo: '',
    ifsc: '',
    upiId: '',
    panCard: '',
    country: '',
    state: '',
  }])
  const [validationErrors, setValidationErrors] = useState([])
  const [isValidating, setIsValidating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importModeOption, setImportModeOption] = useState('dry-run') // 'dry-run', 'safe-insert', 'upsert'
  const [forcePasswordReset, setForcePasswordReset] = useState(true)
  const fileInputRef = useRef(null)

  const addUserRow = () => {
    setUsers([...users, {
      userId: '',
      fullName: '',
      mobile: '',
      email: '',
      sponsorId: '',
      programType: 'investor',
      status: 'active',
      joinDate: '',
      activationDate: '',
      packageId: '',
      investAmount: '',
      packageName: '',
      tempPassword: '',
      bankAccountNo: '',
      ifsc: '',
      upiId: '',
      panCard: '',
      country: '',
      state: '',
    }])
  }

  const removeUserRow = (index) => {
    setUsers(users.filter((_, i) => i !== index))
  }

  const updateUser = (index, field, value) => {
    const updated = [...users]
    updated[index][field] = value
    
    // Auto-fill package name and invest amount when package is selected
    if (field === 'packageId' && value) {
      const selectedPackage = packages.find(pkg => pkg.id === value)
      if (selectedPackage) {
        updated[index].packageName = selectedPackage.name
        updated[index].investAmount = selectedPackage.inrPrice || selectedPackage.amount || ''
      }
    }
    
    setUsers(updated)
  }

  const handleCSVUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedUsers = results.data.map(row => ({
          userId: row.userId || row.user_id || '',
          fullName: row.fullName || row.full_name || row.name || '',
          mobile: row.mobile || row.mobileNumber || row.phone || '',
          email: row.email || row.emailId || '',
          sponsorId: row.sponsorId || row.sponsor_id || row.uplineId || '',
          programType: (row.programType || row.program_type || 'investor').toLowerCase(),
          status: (row.status || 'active').toLowerCase(),
          joinDate: row.joinDate || row.join_date || row.createdAt || '',
          activationDate: row.activationDate || row.activation_date || '',
          packageId: row.packageId || row.package_id || '',
          investAmount: row.investAmount || row.invest_amount || row.amount || '',
          packageName: row.packageName || row.package_name || row.package || '',
          tempPassword: row.tempPassword || row.temp_password || row.password || '',
          bankAccountNo: row.bankAccountNo || row.bank_account_no || row.accountNumber || '',
          ifsc: row.ifsc || row.ifscCode || '',
          upiId: row.upiId || row.upi_id || row.upi || '',
          panCard: row.panCard || row.pan_card || row.pan || '',
          country: row.country || '',
          state: row.state || '',
        }))
        setUsers(parsedUsers)
        toast.success(`Loaded ${parsedUsers.length} users from CSV`)
      },
      error: (error) => {
        toast.error(`Error parsing CSV: ${error.message}`)
      }
    })
  }

  const downloadTemplate = () => {
    const template = [
      {
        userId: 'MTN000001',
        fullName: 'John Doe',
        mobile: '+919876543210',
        email: 'john@example.com',
        sponsorId: '',
        programType: 'investor',
        status: 'active',
          joinDate: '2024-01-01',
          activationDate: '2024-01-01',
          packageId: '',
          investAmount: '10000',
          packageName: 'Starter',
        tempPassword: 'TempPass123!',
        bankAccountNo: '1234567890',
        ifsc: 'SBIN0001234',
        upiId: 'john@upi',
        panCard: 'ABCDE1234F',
        country: 'India',
        state: 'Maharashtra',
      }
    ]
    const csv = Papa.unparse(template)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'user_import_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const validateUsers = async () => {
    setIsValidating(true)
    setValidationErrors([])
    
    try {
      const functions = getFunctions()
      const validateUsers = httpsCallable(functions, 'validateUserImport')
      
      const result = await validateUsers({
        users: users.filter(u => u.userId || u.fullName || u.mobile || u.email),
        importMode: importModeOption
      })

      if (result.data.errors && result.data.errors.length > 0) {
        setValidationErrors(result.data.errors)
        toast.error(`Validation found ${result.data.errors.length} errors`)
      } else {
        toast.success('All users validated successfully!')
      }
    } catch (error) {
      console.error('Validation error:', error)
      toast.error(error.message || 'Validation failed')
    } finally {
      setIsValidating(false)
    }
  }

  const handleImport = async () => {
    if (validationErrors.length > 0) {
      toast.error('Please fix validation errors before importing')
      return
    }

    setIsImporting(true)
    try {
      const functions = getFunctions()
      const importUsers = httpsCallable(functions, 'importUsers')
      
      const result = await importUsers({
        users: users.filter(u => u.userId || u.fullName || u.mobile || u.email),
        importMode: importModeOption,
        forcePasswordReset: forcePasswordReset,
        createdBy: user.uid
      })

      if (result.data.success) {
        toast.success(`Successfully imported ${result.data.inserted || 0} users`)
        if (result.data.batchId) {
          toast.success(`Batch ID: ${result.data.batchId}`)
        }
        // Clear form on success
        setUsers([{
          userId: '',
          fullName: '',
          mobile: '',
          email: '',
          sponsorId: '',
          programType: 'investor',
          status: 'active',
          joinDate: '',
          activationDate: '',
          packageId: '',
          investAmount: '',
          packageName: '',
          tempPassword: '',
          bankAccountNo: '',
          ifsc: '',
          upiId: '',
          panCard: '',
          country: '',
          state: '',
        }])
        setValidationErrors([])
      } else {
        toast.error(result.data.error || 'Import failed')
      }
    } catch (error) {
      console.error('Import error:', error)
      toast.error(error.message || 'Import failed')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Mode Selection */}
      <div className="bg-dark-lighter p-4 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Import Mode</h2>
          <div className="flex gap-4">
            <button
              onClick={() => setImportMode('form')}
              className={`px-4 py-2 rounded ${importMode === 'form' ? 'bg-primary text-white' : 'bg-dark text-gray-300'}`}
            >
              Form Entry
            </button>
            <button
              onClick={() => setImportMode('csv')}
              className={`px-4 py-2 rounded ${importMode === 'csv' ? 'bg-primary text-white' : 'bg-dark text-gray-300'}`}
            >
              CSV Upload
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <label className="flex items-center gap-2 text-gray-300">
            <input
              type="radio"
              value="dry-run"
              checked={importModeOption === 'dry-run'}
              onChange={(e) => setImportModeOption(e.target.value)}
            />
            <span>Dry Run (Preview Only)</span>
          </label>
          <label className="flex items-center gap-2 text-gray-300">
            <input
              type="radio"
              value="safe-insert"
              checked={importModeOption === 'safe-insert'}
              onChange={(e) => setImportModeOption(e.target.value)}
            />
            <span>Safe Insert (Skip Duplicates)</span>
          </label>
          <label className="flex items-center gap-2 text-gray-300">
            <input
              type="radio"
              value="upsert"
              checked={importModeOption === 'upsert'}
              onChange={(e) => setImportModeOption(e.target.value)}
            />
            <span>Upsert (Update Existing)</span>
          </label>
        </div>

        <label className="flex items-center gap-2 text-gray-300">
          <input
            type="checkbox"
            checked={forcePasswordReset}
            onChange={(e) => setForcePasswordReset(e.target.checked)}
          />
          <span>Force password reset on first login</span>
        </label>
      </div>

      {/* CSV Upload */}
      {importMode === 'csv' && (
        <div className="bg-dark-lighter p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">CSV Upload</h3>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
            >
              <Download size={18} />
              Download Template
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-6 py-3 bg-dark text-white rounded hover:bg-dark-lighter border border-gray-700"
          >
            <Upload size={20} />
            Upload CSV File
          </button>
          {users.length > 0 && (
            <p className="text-gray-400 mt-2">{users.length} users loaded</p>
          )}
        </div>
      )}

      {/* Form Entry */}
      {importMode === 'form' && (
        <div className="bg-dark-lighter p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">User Entry Form</h3>
            <button
              onClick={addUserRow}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
            >
              <Plus size={18} />
              Add Row
            </button>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {users.map((user, index) => (
              <div key={index} className="bg-dark p-4 rounded-lg border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-semibold">User #{index + 1}</h4>
                  {users.length > 1 && (
                    <button
                      onClick={() => removeUserRow(index)}
                      className="text-red-500 hover:text-red-400"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">User ID *</label>
                    <input
                      type="text"
                      value={user.userId}
                      onChange={(e) => updateUser(index, 'userId', e.target.value)}
                      placeholder="MTN000001"
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={user.fullName}
                      onChange={(e) => updateUser(index, 'fullName', e.target.value)}
                      placeholder="John Doe"
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Mobile *</label>
                    <input
                      type="text"
                      value={user.mobile}
                      onChange={(e) => updateUser(index, 'mobile', e.target.value)}
                      placeholder="+919876543210"
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Email</label>
                    <input
                      type="email"
                      value={user.email}
                      onChange={(e) => updateUser(index, 'email', e.target.value)}
                      placeholder="john@example.com"
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Sponsor ID</label>
                    <input
                      type="text"
                      value={user.sponsorId}
                      onChange={(e) => updateUser(index, 'sponsorId', e.target.value)}
                      placeholder="MTN000000"
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Program Type *</label>
                    <select
                      value={user.programType}
                      onChange={(e) => updateUser(index, 'programType', e.target.value)}
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    >
                      <option value="investor">Investor</option>
                      <option value="leader">Leader</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Status *</label>
                    <select
                      value={user.status}
                      onChange={(e) => updateUser(index, 'status', e.target.value)}
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Join Date</label>
                    <input
                      type="date"
                      value={user.joinDate}
                      onChange={(e) => updateUser(index, 'joinDate', e.target.value)}
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Activation Date</label>
                    <input
                      type="date"
                      value={user.activationDate}
                      onChange={(e) => updateUser(index, 'activationDate', e.target.value)}
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Package *</label>
                    <select
                      value={user.packageId}
                      onChange={(e) => updateUser(index, 'packageId', e.target.value)}
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    >
                      <option value="">Select Package</option>
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} - ₹{pkg.inrPrice || pkg.amount || 0}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Invest Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={user.investAmount}
                      onChange={(e) => updateUser(index, 'investAmount', e.target.value)}
                      placeholder="Auto-filled from package"
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Package Name</label>
                    <input
                      type="text"
                      value={user.packageName}
                      onChange={(e) => updateUser(index, 'packageName', e.target.value)}
                      placeholder="Auto-filled from package"
                      readOnly
                      className="w-full px-3 py-2 bg-dark-lighter text-gray-500 rounded border border-gray-700 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Temp Password</label>
                    <input
                      type="text"
                      value={user.tempPassword}
                      onChange={(e) => updateUser(index, 'tempPassword', e.target.value)}
                      placeholder="Auto-generate if empty"
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Bank Account No</label>
                    <input
                      type="text"
                      value={user.bankAccountNo}
                      onChange={(e) => updateUser(index, 'bankAccountNo', e.target.value)}
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">IFSC</label>
                    <input
                      type="text"
                      value={user.ifsc}
                      onChange={(e) => updateUser(index, 'ifsc', e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">UPI ID</label>
                    <input
                      type="text"
                      value={user.upiId}
                      onChange={(e) => updateUser(index, 'upiId', e.target.value)}
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">PAN Card</label>
                    <input
                      type="text"
                      value={user.panCard}
                      onChange={(e) => updateUser(index, 'panCard', e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Country</label>
                    <input
                      type="text"
                      value={user.country}
                      onChange={(e) => updateUser(index, 'country', e.target.value)}
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">State</label>
                    <input
                      type="text"
                      value={user.state}
                      onChange={(e) => updateUser(index, 'state', e.target.value)}
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-900/20 border border-red-500 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="text-red-500" size={20} />
            <h3 className="text-red-500 font-semibold">Validation Errors ({validationErrors.length})</h3>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {validationErrors.map((error, idx) => (
              <div key={idx} className="text-sm text-red-400">
                Row {error.row || 'N/A'}: {error.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={validateUsers}
          disabled={isValidating || isImporting}
          className="flex items-center gap-2 px-6 py-3 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
        >
          <CheckCircle2 size={18} />
          {isValidating ? 'Validating...' : 'Validate'}
        </button>
        <button
          onClick={handleImport}
          disabled={isValidating || isImporting || validationErrors.length > 0}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50"
        >
          <Database size={18} />
          {isImporting ? 'Importing...' : 'Import Users'}
        </button>
      </div>
    </div>
  )
}

