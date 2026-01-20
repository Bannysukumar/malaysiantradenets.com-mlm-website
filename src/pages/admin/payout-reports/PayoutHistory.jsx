import { useState, useMemo, useEffect } from 'react'
import { useCollection } from '../../../hooks/useFirestore'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../../../config/firebase'
import ReportFilters from '../../../components/reports/ReportFilters'
import ReportTable from '../../../components/reports/ReportTable'
import { exportToCSV, generateFilename } from '../../../utils/export'
import { formatDate, formatCurrency } from '../../../utils/helpers'
import { useAuth } from '../../../contexts/AuthContext'
import { hasActionPermission } from '../../../utils/permissions'
import toast from 'react-hot-toast'
import { Eye, Edit, X, FileText } from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'

export default function PayoutHistory() {
  const { userData, isSuperAdmin } = useAuth()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState([])
  const [selectedProof, setSelectedProof] = useState(null)
  const [editingPayout, setEditingPayout] = useState(null)
  const [editRemark, setEditRemark] = useState('')

  const canExport = userData?.role === 'superAdmin' || 
                   userData?.role === 'admin' ||
                   hasActionPermission(userData, 'payoutReports', 'export')

  const canViewProof = userData?.role === 'superAdmin' || 
                      userData?.role === 'admin' ||
                      hasActionPermission(userData, 'payoutReports', 'viewProof')

  const loadData = async () => {
    setLoading(true)
    try {
      let q = query(collection(db, 'payouts'), orderBy('createdAt', 'desc'))
      
      if (fromDate || toDate) {
        // Filter by date range if provided
        const payoutsSnapshot = await getDocs(q)
        const filtered = []
        
        payoutsSnapshot.forEach(doc => {
          const data = doc.data()
          const payoutDate = data.paymentDate?.toDate?.() || data.createdAt?.toDate?.()
          
          if (payoutDate) {
            const dateStr = payoutDate.toISOString().split('T')[0]
            if ((!fromDate || dateStr >= fromDate) && (!toDate || dateStr <= toDate)) {
              filtered.push({ id: doc.id, ...data })
            }
          } else if (!fromDate && !toDate) {
            filtered.push({ id: doc.id, ...data })
          }
        })
        
        setReportData(filtered)
      } else {
        const payoutsSnapshot = await getDocs(q)
        const payouts = []
        payoutsSnapshot.forEach(doc => {
          payouts.push({ id: doc.id, ...doc.data() })
        })
        setReportData(payouts)
      }
    } catch (error) {
      console.error('Error loading payout history:', error)
      toast.error('Error loading payout history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredData = useMemo(() => {
    if (!searchTerm) return reportData
    
    const searchLower = searchTerm.toLowerCase()
    return reportData.filter(item =>
      item.memberId?.toLowerCase().includes(searchLower) ||
      item.memberName?.toLowerCase().includes(searchLower) ||
      item.remark?.toLowerCase().includes(searchLower) ||
      item.mode?.toLowerCase().includes(searchLower)
    )
  }, [reportData, searchTerm])

  const handleViewProof = (payout) => {
    if (!canViewProof) {
      toast.error('You do not have permission to view proof')
      return
    }
    setSelectedProof(payout)
  }

  const handleEditRemark = (payout) => {
    setEditingPayout(payout)
    setEditRemark(payout.remark || '')
  }

  const handleSaveRemark = async () => {
    if (!isSuperAdmin) {
      toast.error('Only super admin can edit remarks')
      return
    }

    try {
      await updateDoc(doc(db, 'payouts', editingPayout.id), {
        remark: editRemark,
        updatedAt: new Date()
      })
      toast.success('Remark updated successfully')
      setEditingPayout(null)
      loadData()
    } catch (error) {
      console.error('Error updating remark:', error)
      toast.error('Failed to update remark')
    }
  }

  const handleCancelPayout = async (payout) => {
    if (!isSuperAdmin) {
      toast.error('Only super admin can cancel payouts')
      return
    }

    if (!confirm('Are you sure you want to cancel this payout? This will reverse the balance.')) {
      return
    }

    try {
      // Call Cloud Function to cancel payout
      const { httpsCallable } = await import('firebase/functions')
      const { functions } = await import('../../../config/firebase')
      const cancelPayout = httpsCallable(functions, 'cancelPayout')
      
      await cancelPayout({ payoutId: payout.id })
      toast.success('Payout cancelled successfully')
      loadData()
    } catch (error) {
      console.error('Error cancelling payout:', error)
      toast.error('Failed to cancel payout')
    }
  }

  const columns = [
    { key: 'createdAt', label: 'Record DateTime', sortable: true, render: (val) => formatDate(val) },
    { key: 'paymentDate', label: 'Payment Date', sortable: true, render: (val) => formatDate(val) },
    { key: 'memberId', label: 'Member Id', sortable: true },
    { key: 'memberName', label: 'Member Name', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'mode', label: 'Mode', sortable: true, render: (val) => val || '-' },
    { key: 'remark', label: 'Remark', sortable: true, render: (val, row) => {
      if (editingPayout?.id === row.id) {
        return (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editRemark}
              onChange={(e) => setEditRemark(e.target.value)}
              className="input-field text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRemark()
                if (e.key === 'Escape') setEditingPayout(null)
              }}
            />
            <button onClick={handleSaveRemark} className="btn-secondary text-xs">Save</button>
            <button onClick={() => setEditingPayout(null)} className="btn-secondary text-xs">Cancel</button>
          </div>
        )
      }
      return val || '-'
    }},
    { key: 'status', label: 'Status', sortable: true, render: (val) => {
      const status = val || 'PAID'
      const isCancelled = status === 'CANCELLED'
      return (
        <span className={`badge ${isCancelled ? 'bg-red-500' : 'bg-green-500'} text-xs`}>
          {status}
        </span>
      )
    }},
  ]

  const handleExport = () => {
    if (!canExport) {
      toast.error('You do not have permission to export')
      return
    }

    const dataToExport = filteredData.map(item => ({
      'Record DateTime': formatDate(item.createdAt),
      'Payment Date': formatDate(item.paymentDate),
      'Member Id': item.memberId,
      'Member Name': item.memberName,
      'Amount': item.amount || 0,
      'Mode': item.mode || '-',
      'Remark': item.remark || '-',
      'Status': item.status || 'PAID'
    }))

    exportToCSV(dataToExport, Object.keys(dataToExport[0] || {}).map(key => ({ key, label: key })), 
      generateFilename('payout-history', fromDate, toDate))
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Payout History</h1>

      <ReportFilters
        onSearch={setSearchTerm}
        onDateRangeChange={({ from, to }) => {
          setFromDate(from)
          setToDate(to)
        }}
        onExport={handleExport}
        showDateRange={true}
        showExport={true}
        canExport={canExport}
        dateRange={{ from: fromDate, to: toDate }}
        customFilters={
          <div className="flex items-end">
            <button
              onClick={loadData}
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Find'}
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="card text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                {columns.map((col) => (
                  <th key={col.key} className="text-left py-4 px-4 font-semibold">
                    {col.label}
                  </th>
                ))}
                <th className="text-left py-4 px-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="text-center py-12 text-gray-400">
                    No data found
                  </td>
                </tr>
              ) : (
                filteredData.map((row, index) => (
                  <tr key={row.id || index} className={`border-b border-gray-800 ${index % 2 === 0 ? 'bg-dark-lighter' : ''} hover:bg-dark-light`}>
                    {columns.map((col) => (
                      <td key={col.key} className="py-4 px-4">
                        {col.render ? col.render(row[col.key], row) : row[col.key] || '-'}
                      </td>
                    ))}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {row.proofUrl && (
                          <button
                            onClick={() => handleViewProof(row)}
                            className="btn-secondary text-sm flex items-center gap-1"
                            disabled={!canViewProof}
                          >
                            <Eye size={14} />
                            Proof
                          </button>
                        )}
                        {isSuperAdmin && row.status !== 'CANCELLED' && (
                          <>
                            <button
                              onClick={() => handleEditRemark(row)}
                              className="btn-secondary text-sm flex items-center gap-1"
                            >
                              <Edit size={14} />
                              Edit
                            </button>
                            <button
                              onClick={() => handleCancelPayout(row)}
                              className="btn-secondary text-sm flex items-center gap-1 text-red-400"
                            >
                              <X size={14} />
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Proof Viewer Modal */}
      {selectedProof && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-light border border-gray-700 rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Proof - {selectedProof.memberName}</h2>
              <button
                onClick={() => setSelectedProof(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            {selectedProof.proofUrl && (
              <div className="mt-4">
                {selectedProof.proofUrl.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={selectedProof.proofUrl}
                    className="w-full h-[600px] border border-gray-700 rounded"
                    title="Proof PDF"
                  />
                ) : (
                  <img
                    src={selectedProof.proofUrl}
                    alt="Proof"
                    className="max-w-full h-auto rounded border border-gray-700"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

