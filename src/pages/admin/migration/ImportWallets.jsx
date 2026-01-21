import { useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { getFunctions, httpsCallable } from 'firebase/functions'
import toast from 'react-hot-toast'
import { Wallet, CheckCircle2, AlertCircle, Database } from 'lucide-react'

export default function ImportWallets() {
  const { user } = useAuth()
  const [walletAdjustments, setWalletAdjustments] = useState([{
    userId: '',
    balance: '',
    totalEarned: '',
    totalDeductions: '',
    reason: '',
  }])
  const [validationErrors, setValidationErrors] = useState([])
  const [isValidating, setIsValidating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const addAdjustmentRow = () => {
    setWalletAdjustments([...walletAdjustments, {
      userId: '',
      balance: '',
      totalEarned: '',
      totalDeductions: '',
      reason: '',
    }])
  }

  const removeAdjustmentRow = (index) => {
    setWalletAdjustments(walletAdjustments.filter((_, i) => i !== index))
  }

  const updateAdjustment = (index, field, value) => {
    const updated = [...walletAdjustments]
    updated[index][field] = value
    setWalletAdjustments(updated)
  }

  const validateAdjustments = async () => {
    setIsValidating(true)
    setValidationErrors([])
    
    try {
      const functions = getFunctions()
      const validateWallets = httpsCallable(functions, 'validateWalletAdjustment')
      
      const errors = []
      walletAdjustments.forEach((adj, idx) => {
        if (!adj.userId) {
          errors.push({ row: idx + 1, message: 'User ID is required' })
        }
        if (!adj.balance && !adj.totalEarned && !adj.totalDeductions) {
          errors.push({ row: idx + 1, message: 'At least one wallet field must be set' })
        }
        if (adj.balance && isNaN(parseFloat(adj.balance))) {
          errors.push({ row: idx + 1, message: 'Balance must be a valid number' })
        }
        if (adj.totalEarned && isNaN(parseFloat(adj.totalEarned))) {
          errors.push({ row: idx + 1, message: 'Total Earned must be a valid number' })
        }
        if (adj.totalDeductions && isNaN(parseFloat(adj.totalDeductions))) {
          errors.push({ row: idx + 1, message: 'Total Deductions must be a valid number' })
        }
      })

      if (errors.length > 0) {
        setValidationErrors(errors)
        toast.error(`Validation found ${errors.length} errors`)
      } else {
        toast.success('All adjustments validated successfully!')
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
      const adjustWallets = httpsCallable(functions, 'adjustWalletsFromMigration')
      
      const result = await adjustWallets({
        adjustments: walletAdjustments.filter(a => a.userId),
        createdBy: user.uid
      })

      if (result.data.success) {
        toast.success(`Successfully adjusted ${result.data.adjusted || 0} wallets`)
        if (result.data.batchId) {
          toast.success(`Batch ID: ${result.data.batchId}`)
        }
        // Clear form on success
        setWalletAdjustments([{
          userId: '',
          balance: '',
          totalEarned: '',
          totalDeductions: '',
          reason: '',
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
      <div className="bg-yellow-900/20 border border-yellow-500 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="text-yellow-500" size={20} />
          <h3 className="text-yellow-500 font-semibold">Warning</h3>
        </div>
        <p className="text-gray-300 text-sm">
          Wallet adjustments will create ADJUSTMENT ledger entries for audit purposes. 
          This tool sets absolute values (not increments). Use with caution.
        </p>
      </div>

      <div className="bg-dark-lighter p-6 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Wallet Adjustments</h3>
          <button
            onClick={addAdjustmentRow}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
          >
            <Wallet size={18} />
            Add Row
          </button>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {walletAdjustments.map((adj, index) => (
            <div key={index} className="bg-dark p-4 rounded-lg border border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-semibold">Adjustment #{index + 1}</h4>
                {walletAdjustments.length > 1 && (
                  <button
                    onClick={() => removeAdjustmentRow(index)}
                    className="text-red-500 hover:text-red-400"
                  >
                    Remove
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">User ID *</label>
                  <input
                    type="text"
                    value={adj.userId}
                    onChange={(e) => updateAdjustment(index, 'userId', e.target.value)}
                    placeholder="MTN000001"
                    className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Balance (Absolute)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adj.balance}
                    onChange={(e) => updateAdjustment(index, 'balance', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Total Earned (Absolute)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adj.totalEarned}
                    onChange={(e) => updateAdjustment(index, 'totalEarned', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Total Deductions (Absolute)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={adj.totalDeductions}
                    onChange={(e) => updateAdjustment(index, 'totalDeductions', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-sm text-gray-400 mb-1">Reason *</label>
                  <input
                    type="text"
                    value={adj.reason}
                    onChange={(e) => updateAdjustment(index, 'reason', e.target.value)}
                    placeholder="Migration from old system"
                    className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

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
          onClick={validateAdjustments}
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
          {isImporting ? 'Importing...' : 'Apply Adjustments'}
        </button>
      </div>
    </div>
  )
}

