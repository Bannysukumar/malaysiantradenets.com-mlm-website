import { useState, useMemo } from 'react'
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

export default function DirectReferralReport() {
  const { userData } = useAuth()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState([])

  const canExport = userData?.role === 'superAdmin' || 
                   userData?.role === 'admin' ||
                   hasActionPermission(userData, 'reports', 'export')

  // Get all users for lookup
  const { data: allUsers } = useCollection('users', [])

  const userMap = useMemo(() => {
    const map = {}
    allUsers.forEach(u => {
      map[u.uid || u.id] = u
    })
    return map
  }, [allUsers])

  const handleFind = async () => {
    setLoading(true)
    try {
      // Get all income ledger entries for REFERRAL_DIRECT type
      const allEntries = []
      
      // Get all users
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const userIds = []
      usersSnapshot.forEach(doc => {
        userIds.push(doc.id)
      })

      // Get entries from each user's income ledger
      for (const userId of userIds) {
        try {
          const entriesRef = collection(db, 'incomeLedger', userId, 'entries')
          let q = query(entriesRef, where('type', '==', 'REFERRAL_DIRECT'))
          
          const entriesSnapshot = await getDocs(q)
          entriesSnapshot.forEach(doc => {
            const entry = doc.data()
            const entryDate = entry.createdAt?.toDate?.()
            
            if (entryDate) {
              const dateStr = entryDate.toISOString().split('T')[0]
              if ((!fromDate || dateStr >= fromDate) && (!toDate || dateStr <= toDate)) {
                allEntries.push({
                  id: doc.id,
                  userId,
                  ...entry,
                  entryDate
                })
              }
            }
          })
        } catch (error) {
          // Skip if subcollection doesn't exist
        }
      }

      // Transform to report format
      const transformed = allEntries.map(entry => {
        const member = userMap[entry.userId] || {}
        const sourceUser = userMap[entry.metadata?.sourceUid] || {}
        const investAmount = entry.metadata?.activationAmount || 0
        const grossAmount = entry.amount || 0
        const adminCharge = grossAmount * 0.1 // 10% admin charge
        const netAmount = grossAmount - adminCharge

        return {
          id: entry.id,
          memberId: member.userId || member.uid || '-',
          memberName: member.name || '-',
          date: entry.entryDate,
          referMemberId: sourceUser.userId || sourceUser.uid || '-',
          referMemberName: sourceUser.name || '-',
          investAmount,
          grossAmount,
          adminCharge,
          netAmount
        }
      })

      setReportData(transformed)
    } catch (error) {
      console.error('Error loading report:', error)
      toast.error('Error loading report data')
    } finally {
      setLoading(false)
    }
  }

  const filteredData = useMemo(() => {
    if (!searchTerm) return reportData
    
    const searchLower = searchTerm.toLowerCase()
    return reportData.filter(item =>
      item.memberId?.toLowerCase().includes(searchLower) ||
      item.memberName?.toLowerCase().includes(searchLower) ||
      item.referMemberId?.toLowerCase().includes(searchLower) ||
      item.referMemberName?.toLowerCase().includes(searchLower)
    )
  }, [reportData, searchTerm])

  const columns = [
    { key: 'memberId', label: 'Member ID', sortable: true },
    { key: 'memberName', label: 'Member Name', sortable: true },
    { key: 'date', label: 'Date', sortable: true, render: (val) => formatDate(val) },
    { key: 'referMemberId', label: 'Refer Member ID', sortable: true },
    { key: 'referMemberName', label: 'Refer Member Name', sortable: true },
    { key: 'investAmount', label: 'Invest Amount', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'grossAmount', label: 'Amount (Gross)', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'adminCharge', label: 'TDS/Admin Charges', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'netAmount', label: 'Net Amount', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
  ]

  const handleExport = () => {
    if (!canExport) {
      toast.error('You do not have permission to export')
      return
    }

    const dataToExport = filteredData.map(item => ({
      'Member ID': item.memberId,
      'Member Name': item.memberName,
      'Date': formatDate(item.date),
      'Refer Member ID': item.referMemberId,
      'Refer Member Name': item.referMemberName,
      'Invest Amount': item.investAmount || 0,
      'Amount (Gross)': item.grossAmount || 0,
      'TDS/Admin Charges': item.adminCharge || 0,
      'Net Amount': item.netAmount || 0
    }))

    exportToCSV(dataToExport, Object.keys(dataToExport[0] || {}).map(key => ({ key, label: key })), 
      generateFilename('direct-referral-report', fromDate, toDate))
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Direct Referral Report</h1>

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
              onClick={handleFind}
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
        <ReportTable
          columns={columns}
          data={filteredData}
          pagination={true}
        />
      )}
    </div>
  )
}

