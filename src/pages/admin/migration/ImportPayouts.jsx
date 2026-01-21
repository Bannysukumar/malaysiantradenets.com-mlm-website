import { useState, useRef } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { getFunctions, httpsCallable } from 'firebase/functions'
import toast from 'react-hot-toast'
import { Upload, Plus, Trash2, Download, CheckCircle2, AlertCircle, Database } from 'lucide-react'
import Papa from 'papaparse'

export default function ImportPayouts() {
  const { user } = useAuth()
  const [importMode, setImportMode] = useState('form')
  const [payouts, setPayouts] = useState([{
    userId: '',
    payoutDate: '',
    amount: '',
    mode: 'bank',
    remark: '',
    status: 'paid',
    proofUrl: '',
  }])
  const [validationErrors, setValidationErrors] = useState([])
  const [isValidating, setIsValidating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importModeOption, setImportModeOption] = useState('dry-run')
  const fileInputRef = useRef(null)

  const addPayoutRow = () => {
    setPayouts([...payouts, {
      userId: '',
      payoutDate: '',
      amount: '',
      mode: 'bank',
      remark: '',
      status: 'paid',
      proofUrl: '',
    }])
  }

  const removePayoutRow = (index) => {
    setPayouts(payouts.filter((_, i) => i !== index))
  }

  const updatePayout = (index, field, value) => {
    const updated = [...payouts]
    updated[index][field] = value
    setPayouts(updated)
  }

  const handleCSVUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedPayouts = results.data.map(row => ({
          userId: row.userId || row.user_id || '',
          payoutDate: row.payoutDate || row.payout_date || row.date || '',
          amount: row.amount || '',
          mode: (row.mode || row.method || 'bank').toLowerCase(),
          remark: row.remark || row.description || row.note || '',
          status: (row.status || 'paid').toLowerCase(),
          proofUrl: row.proofUrl || row.proof_url || row.proof || '',
        }))
        setPayouts(parsedPayouts)
        toast.success(`Loaded ${parsedPayouts.length} payout entries from CSV`)
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
        payoutDate: '2024-01-15',
        amount: '5000',
        mode: 'bank',
        remark: 'Withdrawal payout',
        status: 'paid',
        proofUrl: '',
      }
    ]
    const csv = Papa.unparse(template)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'payout_import_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const validatePayouts = async () => {
    setIsValidating(true)
    setValidationErrors([])
    
    try {
      const functions = getFunctions()
      const validatePayouts = httpsCallable(functions, 'validatePayoutImport')
      
      const result = await validatePayouts({
        payouts: payouts.filter(p => p.userId && p.payoutDate && p.amount),
        importMode: importModeOption
      })

      if (result.data.errors && result.data.errors.length > 0) {
        setValidationErrors(result.data.errors)
        toast.error(`Validation found ${result.data.errors.length} errors`)
      } else {
        toast.success('All payout entries validated successfully!')
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
      const importPayouts = httpsCallable(functions, 'importPayouts')
      
      const result = await importPayouts({
        payouts: payouts.filter(p => p.userId && p.payoutDate && p.amount),
        importMode: importModeOption,
        createdBy: user.uid
      })

      if (result.data.success) {
        toast.success(`Successfully imported ${result.data.inserted || 0} payout entries`)
        if (result.data.batchId) {
          toast.success(`Batch ID: ${result.data.batchId}`)
        }
        // Clear form on success
        setPayouts([{
          userId: '',
          payoutDate: '',
          amount: '',
          mode: 'bank',
          remark: '',
          status: 'paid',
          proofUrl: '',
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

        <div className="grid grid-cols-3 gap-4">
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
          {payouts.length > 0 && (
            <p className="text-gray-400 mt-2">{payouts.length} payout entries loaded</p>
          )}
        </div>
      )}

      {/* Form Entry */}
      {importMode === 'form' && (
        <div className="bg-dark-lighter p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Payout Entry Form</h3>
            <button
              onClick={addPayoutRow}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
            >
              <Plus size={18} />
              Add Row
            </button>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {payouts.map((payout, index) => (
              <div key={index} className="bg-dark p-4 rounded-lg border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-semibold">Payout #{index + 1}</h4>
                  {payouts.length > 1 && (
                    <button
                      onClick={() => removePayoutRow(index)}
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
                      value={payout.userId}
                      onChange={(e) => updatePayout(index, 'userId', e.target.value)}
                      placeholder="MTN000001"
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Payout Date *</label>
                    <input
                      type="date"
                      value={payout.payoutDate}
                      onChange={(e) => updatePayout(index, 'payoutDate', e.target.value)}
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={payout.amount}
                      onChange={(e) => updatePayout(index, 'amount', e.target.value)}
                      placeholder="5000"
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Mode *</label>
                    <select
                      value={payout.mode}
                      onChange={(e) => updatePayout(index, 'mode', e.target.value)}
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    >
                      <option value="bank">Bank</option>
                      <option value="upi">UPI</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Status *</label>
                    <select
                      value={payout.status}
                      onChange={(e) => updatePayout(index, 'status', e.target.value)}
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    >
                      <option value="paid">Paid</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-sm text-gray-400 mb-1">Remark</label>
                    <input
                      type="text"
                      value={payout.remark}
                      onChange={(e) => updatePayout(index, 'remark', e.target.value)}
                      placeholder="Withdrawal payout"
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div className="md:col-span-2 lg:col-span-4">
                    <label className="block text-sm text-gray-400 mb-1">Proof URL (Optional)</label>
                    <input
                      type="url"
                      value={payout.proofUrl}
                      onChange={(e) => updatePayout(index, 'proofUrl', e.target.value)}
                      placeholder="https://example.com/proof.jpg"
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
          onClick={validatePayouts}
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
          {isImporting ? 'Importing...' : 'Import Payouts'}
        </button>
      </div>
    </div>
  )
}

