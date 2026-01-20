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

export default function LevelOnROIReport() {
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

  const { data: allUsers } = useCollection('users', [])

  const loadData = async () => {
    setLoading(true)
    try {
      const levelOnROIData = []
      
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const userIds = []
      usersSnapshot.forEach(doc => {
        userIds.push(doc.id)
      })

      for (const userId of userIds) {
        try {
          const entriesRef = collection(db, 'incomeLedger', userId, 'entries')
          let q = query(entriesRef, where('type', '==', 'REFERRAL_LEVEL'))
          
          const entriesSnapshot = await getDocs(q)
          let totalLevelOnROI = 0
          const entries = []
          
          entriesSnapshot.forEach(doc => {
            const entry = doc.data()
            const entryDate = entry.createdAt?.toDate?.()
            
            if (entryDate) {
              const dateStr = entryDate.toISOString().split('T')[0]
              if ((!fromDate || dateStr >= fromDate) && (!toDate || dateStr <= toDate)) {
                totalLevelOnROI += entry.amount || 0
                entries.push({
                  id: doc.id,
                  ...entry,
                  entryDate,
                  level: entry.metadata?.level || 0,
                  sourceUid: entry.metadata?.sourceUid || ''
                })
              }
            } else if (!fromDate && !toDate) {
              totalLevelOnROI += entry.amount || 0
              entries.push({
                id: doc.id,
                ...entry,
                level: entry.metadata?.level || 0,
                sourceUid: entry.metadata?.sourceUid || ''
              })
            }
          })

          if (totalLevelOnROI > 0 || entries.length > 0) {
            const user = allUsers.find(u => (u.uid || u.id) === userId)
            levelOnROIData.push({
              id: userId,
              userId: user?.userId || userId,
              name: user?.name || '-',
              totalLevelOnROI,
              entries
            })
          }
        } catch (error) {
          // Skip if subcollection doesn't exist
        }
      }

      setReportData(levelOnROIData)
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error loading report data')
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
      item.name?.toLowerCase().includes(searchLower) ||
      item.userId?.toLowerCase().includes(searchLower)
    )
  }, [reportData, searchTerm])

  const handleViewDetails = (user) => {
    setSelectedUser(user)
    
    // Transform entries to details format
    const details = user.entries.map(entry => {
      const sourceUser = allUsers.find(u => (u.uid || u.id) === entry.sourceUid)
      const roiBase = entry.metadata?.roiBase || entry.metadata?.activationAmount || 0
      const percent = entry.metadata?.percent || 0
      
      return {
        ...entry,
        level: entry.level || 0,
        sourceMember: sourceUser?.name || '-',
        roiBase,
        percent,
        amount: entry.amount || 0,
        date: entry.entryDate || entry.createdAt
      }
    })
    
    setDetailsData(details)
  }

  const columns = [
    { key: 'name', label: 'Member Name', sortable: true },
    { key: 'userId', label: 'Member Id', sortable: true },
    { key: 'totalLevelOnROI', label: 'ROI (or Level on ROI total)', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
  ]

  const detailsColumns = [
    { key: 'level', label: 'Level', sortable: true, render: (val) => `Level ${val || 0}` },
    { key: 'sourceMember', label: 'Source Member', sortable: true },
    { key: 'roiBase', label: 'ROI Base Amount', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'percent', label: 'Percent', sortable: true, render: (val) => `${val || 0}%` },
    { key: 'amount', label: 'Amount', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'date', label: 'Date', sortable: true, render: (val) => formatDate(val) },
  ]

  const handleExport = () => {
    if (!canExport) {
      toast.error('You do not have permission to export')
      return
    }

    const dataToExport = filteredData.map(item => ({
      'Member Name': item.name,
      'Member Id': item.userId,
      'ROI (or Level on ROI total)': item.totalLevelOnROI || 0
    }))

    exportToCSV(dataToExport, Object.keys(dataToExport[0] || {}).map(key => ({ key, label: key })), 
      generateFilename('level-on-roi-report', fromDate, toDate))
  }

  const handleExportDetails = () => {
    if (!canExport) {
      toast.error('You do not have permission to export')
      return
    }

    const dataToExport = detailsData.map(item => ({
      'Level': `Level ${item.level || 0}`,
      'Source Member': item.sourceMember,
      'ROI Base Amount': item.roiBase || 0,
      'Percent': `${item.percent || 0}%`,
      'Amount': item.amount || 0,
      'Date': formatDate(item.date)
    }))

    exportToCSV(dataToExport, Object.keys(dataToExport[0] || {}).map(key => ({ key, label: key })), 
      generateFilename(`level-on-roi-details-${selectedUser?.userId}`, fromDate, toDate))
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Level on ROI Report</h1>

      <ReportFilters
        onSearch={setSearchTerm}
        onDateRangeChange={({ from, to }) => {
          setFromDate(from)
          setToDate(to)
          loadData()
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
              <h2 className="text-2xl font-bold">Level on ROI Details - {selectedUser.name}</h2>
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

