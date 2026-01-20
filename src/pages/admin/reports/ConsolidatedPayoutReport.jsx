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

export default function ConsolidatedPayoutReport({ excludeDirect = false }) {
  const { userData } = useAuth()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState([])

  const canExport = userData?.role === 'superAdmin' || 
                   userData?.role === 'admin' ||
                   hasActionPermission(userData, 'reports', 'export')

  const { data: allUsers } = useCollection('users', [])
  const { data: withdrawals } = useCollection('withdrawals', [])

  const loadData = async () => {
    setLoading(true)
    try {
      const consolidated = []
      
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const userIds = []
      usersSnapshot.forEach(doc => {
        userIds.push(doc.id)
      })

      for (const userId of userIds) {
        try {
          // Get all income entries
          const entriesRef = collection(db, 'incomeLedger', userId, 'entries')
          const entriesSnapshot = await getDocs(entriesRef)
          
          let direct = 0
          let roi = 0
          let levelOnROI = 0
          
          entriesSnapshot.forEach(doc => {
            const entry = doc.data()
            const entryDate = entry.createdAt?.toDate?.()
            
            if (entryDate) {
              const dateStr = entryDate.toISOString().split('T')[0]
              if ((!fromDate || dateStr >= fromDate) && (!toDate || dateStr <= toDate)) {
                const amount = entry.amount || 0
                if (entry.type === 'REFERRAL_DIRECT') {
                  direct += amount
                } else if (entry.type === 'daily_roi') {
                  roi += amount
                } else if (entry.type === 'REFERRAL_LEVEL') {
                  levelOnROI += amount
                }
              }
            }
          })

          const totalPayout = excludeDirect ? (roi + levelOnROI) : (direct + roi + levelOnROI)
          const tds = totalPayout * 0.05 // 5% TDS (adjust as needed)
          const adminCharges = totalPayout * 0.1 // 10% admin charges
          const netPayment = totalPayout - tds - adminCharges

          // Get paid amount from withdrawals
          const userWithdrawals = withdrawals.filter(w => 
            (w.uid || w.userId) === userId && 
            w.status === 'paid'
          )
          const amountPaid = userWithdrawals.reduce((sum, w) => sum + (w.amountRequested || w.netAmount || 0), 0)
          const netBalance = netPayment - amountPaid

          if (totalPayout > 0 || amountPaid > 0) {
            const user = allUsers.find(u => (u.uid || u.id) === userId)
            consolidated.push({
              id: userId,
              userId: user?.userId || userId,
              name: user?.name || '-',
              direct,
              roi,
              levelOnROI,
              totalPayout,
              tds,
              adminCharges,
              netPayment,
              amountPaid,
              netBalance
            })
          }
        } catch (error) {
          // Skip if subcollection doesn't exist
        }
      }

      setReportData(consolidated)
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Error loading report data')
    } finally {
      setLoading(false)
    }
  }

  const filteredData = useMemo(() => {
    if (!searchTerm) return reportData
    
    const searchLower = searchTerm.toLowerCase()
    return reportData.filter(item =>
      item.name?.toLowerCase().includes(searchLower) ||
      item.userId?.toLowerCase().includes(searchLower)
    )
  }, [reportData, searchTerm])

  const columns = [
    { key: 'sno', label: 'Sr.No', sortable: false, render: (_, row, index) => index + 1 },
    { key: 'userId', label: 'Member Id', sortable: true },
    { key: 'name', label: 'Member Name', sortable: true },
    { key: 'direct', label: 'Direct', sortable: true, render: (val) => excludeDirect ? '-' : formatCurrency(val || 0, 'INR') },
    { key: 'roi', label: 'ROI', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'levelOnROI', label: 'Level On ROI', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'totalPayout', label: 'Total Payout', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'tds', label: 'TDS', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'adminCharges', label: 'Admin Charges', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'netPayment', label: 'Net Payment', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'amountPaid', label: 'Amount Paid', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'netBalance', label: 'Net Balance', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
  ]

  const handleExport = () => {
    if (!canExport) {
      toast.error('You do not have permission to export')
      return
    }

    const dataToExport = filteredData.map((item, index) => ({
      'Sr.No': index + 1,
      'Member Id': item.userId,
      'Member Name': item.name,
      'Direct': item.direct || 0,
      'ROI': item.roi || 0,
      'Level On ROI': item.levelOnROI || 0,
      'Total Payout': item.totalPayout || 0,
      'TDS': item.tds || 0,
      'Admin Charges': item.adminCharges || 0,
      'Net Payment': item.netPayment || 0,
      'Amount Paid': item.amountPaid || 0,
      'Net Balance': item.netBalance || 0
    }))

    exportToCSV(dataToExport, Object.keys(dataToExport[0] || {}).map(key => ({ key, label: key })), 
      generateFilename('consolidated-payout-report', fromDate, toDate))
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">
        {excludeDirect ? 'Consolidated Payout without Direct Referral' : 'Consolidated Payout'}
      </h1>

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
        <ReportTable
          columns={columns}
          data={filteredData}
          pagination={true}
        />
      )}
    </div>
  )
}

