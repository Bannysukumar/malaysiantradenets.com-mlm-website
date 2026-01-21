import { useState, useRef } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { getFunctions, httpsCallable } from 'firebase/functions'
import toast from 'react-hot-toast'
import { Upload, Plus, Trash2, Download, CheckCircle2, AlertCircle, Database } from 'lucide-react'
import Papa from 'papaparse'

export default function ImportIncomes() {
  const { user } = useAuth()
  const [importMode, setImportMode] = useState('form')
  const [incomes, setIncomes] = useState([{
    userId: '',
    date: '',
    incomeType: 'DIRECT',
    amountGross: '',
    adminCharge: '',
    tds: '',
    amountNet: '',
    referenceUserId: '',
    level: '',
    remark: '',
  }])
  const [validationErrors, setValidationErrors] = useState([])
  const [isValidating, setIsValidating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importModeOption, setImportModeOption] = useState('dry-run')
  const fileInputRef = useRef(null)

  const incomeTypes = [
    'DIRECT',
    'ROI',
    'LEVEL_ON_ROI',
    'BONANZA',
    'ADJUSTMENT',
    'REFERRAL_DIRECT',
    'REFERRAL_LEVEL',
    'TRANSFER_RECEIVED',
    'ADMIN_CREDIT',
  ]

  const addIncomeRow = () => {
    setIncomes([...incomes, {
      userId: '',
      date: '',
      incomeType: 'DIRECT',
      amountGross: '',
      adminCharge: '',
      tds: '',
      amountNet: '',
      referenceUserId: '',
      level: '',
      remark: '',
    }])
  }

  const removeIncomeRow = (index) => {
    setIncomes(incomes.filter((_, i) => i !== index))
  }

  const updateIncome = (index, field, value) => {
    const updated = [...incomes]
    updated[index][field] = value
    
    // Auto-calculate net amount
    if (field === 'amountGross' || field === 'adminCharge' || field === 'tds') {
      const gross = parseFloat(updated[index].amountGross) || 0
      const admin = parseFloat(updated[index].adminCharge) || 0
      const tds = parseFloat(updated[index].tds) || 0
      updated[index].amountNet = (gross - admin - tds).toFixed(2)
    }
    
    setIncomes(updated)
  }

  const handleCSVUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedIncomes = results.data.map(row => {
          const gross = parseFloat(row.amountGross || row.amount_gross || row.gross || 0)
          const admin = parseFloat(row.adminCharge || row.admin_charge || row.charge || 0)
          const tds = parseFloat(row.tds || row.tax || 0)
          const net = gross - admin - tds

          return {
            userId: row.userId || row.user_id || '',
            date: row.date || row.createdAt || '',
            incomeType: (row.incomeType || row.income_type || row.type || 'DIRECT').toUpperCase(),
            amountGross: gross.toString(),
            adminCharge: admin.toString(),
            tds: tds.toString(),
            amountNet: net.toFixed(2),
            referenceUserId: row.referenceUserId || row.reference_user_id || row.fromUserId || '',
            level: row.level || '',
            remark: row.remark || row.description || row.note || '',
          }
        })
        setIncomes(parsedIncomes)
        toast.success(`Loaded ${parsedIncomes.length} income entries from CSV`)
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
        date: '2024-01-15',
        incomeType: 'DIRECT',
        amountGross: '1000',
        adminCharge: '0',
        tds: '0',
        amountNet: '1000',
        referenceUserId: 'MTN000002',
        level: '1',
        remark: 'Direct referral income',
      }
    ]
    const csv = Papa.unparse(template)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'income_import_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const validateIncomes = async () => {
    setIsValidating(true)
    setValidationErrors([])
    
    try {
      const functions = getFunctions()
      const validateIncomes = httpsCallable(functions, 'validateIncomeImport')
      
      const result = await validateIncomes({
        incomes: incomes.filter(i => i.userId && i.date && i.amountGross),
        importMode: importModeOption
      })

      if (result.data.errors && result.data.errors.length > 0) {
        setValidationErrors(result.data.errors)
        toast.error(`Validation found ${result.data.errors.length} errors`)
      } else {
        toast.success('All income entries validated successfully!')
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
      const importIncomes = httpsCallable(functions, 'importIncomes')
      
      const result = await importIncomes({
        incomes: incomes.filter(i => i.userId && i.date && i.amountGross),
        importMode: importModeOption,
        createdBy: user.uid
      })

      if (result.data.success) {
        toast.success(`Successfully imported ${result.data.inserted || 0} income entries`)
        if (result.data.batchId) {
          toast.success(`Batch ID: ${result.data.batchId}`)
        }
        // Clear form on success
        setIncomes([{
          userId: '',
          date: '',
          incomeType: 'DIRECT',
          amountGross: '',
          adminCharge: '',
          tds: '',
          amountNet: '',
          referenceUserId: '',
          level: '',
          remark: '',
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
          {incomes.length > 0 && (
            <p className="text-gray-400 mt-2">{incomes.length} income entries loaded</p>
          )}
        </div>
      )}

      {/* Form Entry */}
      {importMode === 'form' && (
        <div className="bg-dark-lighter p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Income Entry Form</h3>
            <button
              onClick={addIncomeRow}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
            >
              <Plus size={18} />
              Add Row
            </button>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {incomes.map((income, index) => (
              <div key={index} className="bg-dark p-4 rounded-lg border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-semibold">Entry #{index + 1}</h4>
                  {incomes.length > 1 && (
                    <button
                      onClick={() => removeIncomeRow(index)}
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
                      value={income.userId}
                      onChange={(e) => updateIncome(index, 'userId', e.target.value)}
                      placeholder="MTN000001"
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Date *</label>
                    <input
                      type="date"
                      value={income.date}
                      onChange={(e) => updateIncome(index, 'date', e.target.value)}
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Income Type *</label>
                    <select
                      value={income.incomeType}
                      onChange={(e) => updateIncome(index, 'incomeType', e.target.value)}
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    >
                      {incomeTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Gross Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={income.amountGross}
                      onChange={(e) => updateIncome(index, 'amountGross', e.target.value)}
                      placeholder="1000"
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Admin Charge</label>
                    <input
                      type="number"
                      step="0.01"
                      value={income.adminCharge}
                      onChange={(e) => updateIncome(index, 'adminCharge', e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">TDS</label>
                    <input
                      type="number"
                      step="0.01"
                      value={income.tds}
                      onChange={(e) => updateIncome(index, 'tds', e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Net Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={income.amountNet}
                      readOnly
                      className="w-full px-3 py-2 bg-dark-lighter text-gray-500 rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Reference User ID</label>
                    <input
                      type="text"
                      value={income.referenceUserId}
                      onChange={(e) => updateIncome(index, 'referenceUserId', e.target.value)}
                      placeholder="MTN000002"
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Level</label>
                    <input
                      type="number"
                      value={income.level}
                      onChange={(e) => updateIncome(index, 'level', e.target.value)}
                      placeholder="1"
                      className="w-full px-3 py-2 bg-dark-lighter text-white rounded border border-gray-700"
                    />
                  </div>
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-sm text-gray-400 mb-1">Remark</label>
                    <input
                      type="text"
                      value={income.remark}
                      onChange={(e) => updateIncome(index, 'remark', e.target.value)}
                      placeholder="Description or note"
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
          onClick={validateIncomes}
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
          {isImporting ? 'Importing...' : 'Import Incomes'}
        </button>
      </div>
    </div>
  )
}

