import { useState, useMemo, useEffect } from 'react'
import { useCollection } from '../../../hooks/useFirestore'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../../config/firebase'
import ReportFilters from '../../../components/reports/ReportFilters'
import ReportTable from '../../../components/reports/ReportTable'
import { exportToCSV, generateFilename } from '../../../utils/export'
import { formatDate, formatCurrency } from '../../../utils/helpers'
import { useAuth } from '../../../contexts/AuthContext'
import { hasActionPermission } from '../../../utils/permissions'
import toast from 'react-hot-toast'
import { Eye, X } from 'lucide-react'

export default function ROIReport() {
  const { userData } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [detailsData, setDetailsData] = useState([])

  const canExport = userData?.role === 'superAdmin' || 
                   userData?.role === 'admin' ||
                   hasActionPermission(userData, 'reports', 'export')

  // Get all users
  const { data: allUsers } = useCollection('users', [])

  const loadROIData = async () => {
    setLoading(true)
    try {
      const roiData = []
      
      // Get all users
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const userIds = []
      usersSnapshot.forEach(doc => {
        userIds.push(doc.id)
      })

      // Get ROI entries for each user
      for (const userId of userIds) {
        try {
          const entriesRef = collection(db, 'incomeLedger', userId, 'entries')
          let q = query(entriesRef, where('type', '==', 'daily_roi'))
          
          if (fromDate || toDate) {
            // Filter by date if provided
            const entriesSnapshot = await getDocs(q)
            entriesSnapshot.forEach(doc => {
              const entry = doc.data()
              const entryDate = entry.createdAt?.toDate?.()
              if (entryDate) {
                const dateStr = entryDate.toISOString().split('T')[0]
                if ((!fromDate || dateStr >= fromDate) && (!toDate || dateStr <= toDate)) {
                  // Include this entry
                } else {
                  return // Skip this entry
                }
              }
            })
          }

          const entriesSnapshot = await getDocs(q)
          let totalROI = 0
          const entries = []
          
          entriesSnapshot.forEach(doc => {
            const entry = doc.data()
            const entryDate = entry.createdAt?.toDate?.()
            
            if (!fromDate && !toDate) {
              // Till date - include all
              totalROI += entry.amount || 0
              entries.push({ id: doc.id, ...entry, entryDate })
            } else if (entryDate) {
              const dateStr = entryDate.toISOString().split('T')[0]
              if ((!fromDate || dateStr >= fromDate) && (!toDate || dateStr <= toDate)) {
                totalROI += entry.amount || 0
                entries.push({ id: doc.id, ...entry, entryDate })
              }
            }
          })

          if (totalROI > 0 || entries.length > 0) {
            const user = allUsers.find(u => (u.uid || u.id) === userId)
            roiData.push({
              id: userId,
              userId: user?.userId || userId,
              name: user?.name || '-',
              totalROI,
              entries
            })
          }
        } catch (error) {
          // Skip if subcollection doesn't exist
        }
      }

      setReportData(roiData)
    } catch (error) {
      console.error('Error loading ROI data:', error)
      toast.error('Error loading ROI data')
    } finally {
      setLoading(false)
    }
  }

  // Load data on mount
  useEffect(() => {
    loadROIData()
  }, [])

  const filteredData = useMemo(() => {
    if (!searchTerm) return reportData
    
    const searchLower = searchTerm.toLowerCase()
    return reportData.filter(item =>
      item.name?.toLowerCase().includes(searchLower) ||
      item.userId?.toLowerCase().includes(searchLower)
    )
  }, [reportData, searchTerm])

  const handleViewDetails = (user) => {
    setSelectedUser(user)
    setDetailsData(user.entries || [])
  }

  const columns = [
    { key: 'name', label: 'Member Name', sortable: true },
    { key: 'userId', label: 'Member ID', sortable: true },
    { key: 'totalROI', label: 'ROI (Total)', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
  ]

  const detailsColumns = [
    { key: 'entryDate', label: 'Date', sortable: true, render: (val) => formatDate(val) },
    { key: 'amount', label: 'ROI Amount', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'adminCharge', label: 'Admin Charge', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'netAmount', label: 'Net Amount', sortable: true, render: (val) => {
      const amount = val || 0
      const adminCharge = 0 // Calculate if needed
      return formatCurrency(amount - adminCharge, 'INR')
    }},
    { key: 'status', label: 'Status', sortable: true, render: (val) => {
      const status = val?.toLowerCase() || ''
      const isApproved = status === 'approved' || status === 'completed'
      return (
        <span className={`badge ${isApproved ? 'bg-green-500' : 'bg-yellow-500'} text-xs`}>
          {status || 'Pending'}
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
      'Member Name': item.name,
      'Member ID': item.userId,
      'ROI (Total)': item.totalROI || 0
    }))

    exportToCSV(dataToExport, Object.keys(dataToExport[0] || {}).map(key => ({ key, label: key })), 
      generateFilename('roi-report', fromDate, toDate))
  }

  const handleExportDetails = () => {
    if (!canExport) {
      toast.error('You do not have permission to export')
      return
    }

    const dataToExport = detailsData.map(item => ({
      'Date': formatDate(item.entryDate),
      'ROI Amount': item.amount || 0,
      'Admin Charge': 0,
      'Net Amount': item.amount || 0,
      'Status': item.status || 'Pending'
    }))

    exportToCSV(dataToExport, Object.keys(dataToExport[0] || {}).map(key => ({ key, label: key })), 
      generateFilename(`roi-details-${selectedUser?.userId}`, fromDate, toDate))
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">ROI Report (User Wise ROI Income)</h1>

      <ReportFilters
        onSearch={setSearchTerm}
        onDateRangeChange={({ from, to }) => {
          setFromDate(from)
          setToDate(to)
          loadROIData()
        }}
        onExport={handleExport}
        showDateRange={true}
        showExport={true}
        canExport={canExport}
        dateRange={{ from: fromDate, to: toDate }}
      />

      {loading ? (
        <div className="card text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : (
        <ReportTable
          columns={columns}
          data={filteredData}
          pagination={true}
          onViewDetails={handleViewDetails}
        />
      )}

      {/* Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-light border border-gray-700 rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">ROI Details - {selectedUser.name}</h2>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mb-4">
              <button
                onClick={handleExportDetails}
                className="btn-secondary"
                disabled={!canExport}
              >
                Export Details
              </button>
            </div>

            <ReportTable
              columns={detailsColumns}
              data={detailsData}
              pagination={true}
            />
          </div>
        </div>
      )}
    </div>
  )
}

