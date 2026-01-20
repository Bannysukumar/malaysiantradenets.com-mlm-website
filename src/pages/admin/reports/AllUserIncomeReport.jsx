import { useState, useMemo, useEffect } from 'react'
import { useCollection } from '../../../hooks/useFirestore'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../../config/firebase'
import ReportFilters from '../../../components/reports/ReportFilters'
import ReportTable from '../../../components/reports/ReportTable'
import { exportToCSV, generateFilename } from '../../../utils/export'
import { formatDate, formatCurrency } from '../../../utils/helpers'
import { useAuth } from '../../../contexts/AuthContext'
import { hasActionPermission } from '../../../utils/permissions'
import toast from 'react-hot-toast'

export default function AllUserIncomeReport() {
  const { userData } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
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
      const incomeData = []
      
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const userIds = []
      usersSnapshot.forEach(doc => {
        userIds.push(doc.id)
      })

      for (const userId of userIds) {
        try {
          const entriesRef = collection(db, 'incomeLedger', userId, 'entries')
          const entriesSnapshot = await getDocs(entriesRef)
          
          let direct = 0
          let roi = 0
          let levelOnROI = 0
          
          entriesSnapshot.forEach(doc => {
            const entry = doc.data()
            const entryDate = entry.createdAt?.toDate?.()
            
            // Till date or within date range
            if (!fromDate && !toDate) {
              // Till date - include all
              const amount = entry.amount || 0
              if (entry.type === 'REFERRAL_DIRECT') {
                direct += amount
              } else if (entry.type === 'daily_roi') {
                roi += amount
              } else if (entry.type === 'REFERRAL_LEVEL') {
                levelOnROI += amount
              }
            } else if (entryDate) {
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

          const totalIncome = direct + roi + levelOnROI
          const totalDeductions = totalIncome * 0.15 // 10% admin + 5% TDS (adjust as needed)
          const netAmount = totalIncome - totalDeductions

          // Get paid amount
          const userWithdrawals = withdrawals.filter(w => 
            (w.uid || w.userId) === userId && 
            w.status === 'paid'
          )
          const amountPaid = userWithdrawals.reduce((sum, w) => sum + (w.amountRequested || w.netAmount || 0), 0)
          const balanceToBePaid = netAmount - amountPaid

          // Get user package for investment amount
          const userPackagesRef = collection(db, 'userPackages')
          const packagesSnapshot = await getDocs(userPackagesRef)
          let amountInvested = 0
          packagesSnapshot.forEach(doc => {
            const pkg = doc.data()
            if (pkg.userId === userId && pkg.status === 'active') {
              amountInvested += pkg.amount || pkg.inrPrice || 0
            }
          })

          const user = allUsers.find(u => (u.uid || u.id) === userId)
          incomeData.push({
            id: userId,
            userId: user?.userId || userId,
            name: user?.name || '-',
            phone: user?.phone || '-',
            joiningDate: user?.createdAt,
            activationDate: user?.updatedAt, // Use package activation date if available
            amountInvested,
            direct,
            roi,
            levelOnROI,
            totalIncome,
            totalDeductions,
            netAmount,
            amountPaid,
            balanceToBePaid
          })
        } catch (error) {
          // Skip if subcollection doesn't exist
        }
      }

      setReportData(incomeData)
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
      item.userId?.toLowerCase().includes(searchLower) ||
      item.phone?.includes(searchTerm)
    )
  }, [reportData, searchTerm])

  const columns = [
    { key: 'userId', label: 'Member Id', sortable: true },
    { key: 'name', label: 'Member Name', sortable: true },
    { key: 'phone', label: 'Phone Number', sortable: true },
    { key: 'joiningDate', label: 'Joining Date', sortable: true, render: (val) => formatDate(val) },
    { key: 'activationDate', label: 'Activation Date', sortable: true, render: (val) => formatDate(val) },
    { key: 'amountInvested', label: 'Amount Invested', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'direct', label: 'Direct', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'roi', label: 'ROI', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'levelOnROI', label: 'Level On ROI', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'totalIncome', label: 'Total Income', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'totalDeductions', label: 'Total Deductions', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'netAmount', label: 'Net Amount', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'amountPaid', label: 'Amount Paid', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'balanceToBePaid', label: 'Balance To Be Paid', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
  ]

  const handleExport = () => {
    if (!canExport) {
      toast.error('You do not have permission to export')
      return
    }

    const dataToExport = filteredData.map(item => ({
      'Member Id': item.userId,
      'Member Name': item.name,
      'Phone Number': item.phone || '-',
      'Joining Date': formatDate(item.joiningDate),
      'Activation Date': formatDate(item.activationDate),
      'Amount Invested': item.amountInvested || 0,
      'Direct': item.direct || 0,
      'ROI': item.roi || 0,
      'Level On ROI': item.levelOnROI || 0,
      'Total Income': item.totalIncome || 0,
      'Total Deductions': item.totalDeductions || 0,
      'Net Amount': item.netAmount || 0,
      'Amount Paid': item.amountPaid || 0,
      'Balance To Be Paid': item.balanceToBePaid || 0
    }))

    exportToCSV(dataToExport, Object.keys(dataToExport[0] || {}).map(key => ({ key, label: key })), 
      generateFilename('all-user-income-report', fromDate, toDate))
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">All User Income Till Date</h1>

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
        />
      )}
    </div>
  )
}

