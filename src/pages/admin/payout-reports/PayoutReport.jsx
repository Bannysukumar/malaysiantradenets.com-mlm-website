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
import { Eye, IndianRupee } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function PayoutReport() {
  const { userData } = useAuth()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState([])
  const [showZeroBalance, setShowZeroBalance] = useState(false)

  const canExport = userData?.role === 'superAdmin' || 
                   userData?.role === 'admin' ||
                   hasActionPermission(userData, 'payoutReports', 'export')

  const { data: allUsers } = useCollection('users', [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Get all user summaries from reportUserSummary collection
      // If collection doesn't exist, calculate from incomeLedger and withdrawals
      let summaries = []
      
      try {
        const summariesSnapshot = await getDocs(collection(db, 'reportUserSummary'))
        summariesSnapshot.forEach(doc => {
          const data = doc.data()
          if (data.balanceToBePaid > 0 || showZeroBalance) {
            summaries.push({
              id: doc.id,
              ...data
            })
          }
        })
      } catch (error) {
        // If collection doesn't exist, calculate from existing data
        console.log('reportUserSummary collection not found, calculating from existing data...')
        
        const usersSnapshot = await getDocs(collection(db, 'users'))
        const userIds = []
        usersSnapshot.forEach(doc => {
          userIds.push(doc.id)
        })

        for (const userId of userIds) {
          try {
            // Get income entries
            const entriesRef = collection(db, 'incomeLedger', userId, 'entries')
            const entriesSnapshot = await getDocs(entriesRef)
            
            let totalIncome = 0
            entriesSnapshot.forEach(doc => {
              const entry = doc.data()
              const entryDate = entry.createdAt?.toDate?.()
              
              if (!fromDate && !toDate) {
                totalIncome += entry.amount || 0
              } else if (entryDate) {
                const dateStr = entryDate.toISOString().split('T')[0]
                if ((!fromDate || dateStr >= fromDate) && (!toDate || dateStr <= toDate)) {
                  totalIncome += entry.amount || 0
                }
              }
            })

            // Get withdrawals (paid amounts)
            const withdrawalsSnapshot = await getDocs(
              query(collection(db, 'withdrawals'), where('uid', '==', userId), where('status', '==', 'paid'))
            )
            let amountPaid = 0
            withdrawalsSnapshot.forEach(doc => {
              amountPaid += doc.data().amountRequested || doc.data().netAmount || 0
            })

            const netAmount = totalIncome - (totalIncome * 0.15) // 15% deductions
            const balanceToBePaid = netAmount - amountPaid

            if (balanceToBePaid > 0 || showZeroBalance) {
              const user = allUsers.find(u => (u.uid || u.id) === userId)
              if (user) {
                summaries.push({
                  id: userId,
                  memberId: user.userId || userId,
                  name: user.name || '-',
                  mobile: user.phone || '-',
                  bank: user.bank || {},
                  netAmount,
                  amountPaid,
                  balanceToBePaid
                })
              }
            }
          } catch (error) {
            // Skip if subcollection doesn't exist
          }
        }
      }

      setReportData(summaries)
    } catch (error) {
      console.error('Error loading payout report:', error)
      toast.error('Error loading payout report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [showZeroBalance])

  const filteredData = useMemo(() => {
    if (!searchTerm) return reportData
    
    const searchLower = searchTerm.toLowerCase()
    return reportData.filter(item =>
      item.memberId?.toLowerCase().includes(searchLower) ||
      item.name?.toLowerCase().includes(searchLower) ||
      item.mobile?.includes(searchTerm) ||
      item.bank?.accountNo?.includes(searchTerm) ||
      item.bank?.ifsc?.toLowerCase().includes(searchLower)
    )
  }, [reportData, searchTerm])

  const columns = [
    { key: 'memberId', label: 'Member ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'mobile', label: 'Mobile', sortable: true },
    { key: 'bankAccountNo', label: 'Bank Account No', sortable: true, render: (_, row) => row.bank?.accountNo || '-' },
    { key: 'bankName', label: 'Bank Name', sortable: true, render: (_, row) => row.bank?.bankName || '-' },
    { key: 'branch', label: 'Branch', sortable: true, render: (_, row) => row.bank?.branch || '-' },
    { key: 'ifsc', label: 'IFSC Code', sortable: true, render: (_, row) => row.bank?.ifsc || '-' },
    { key: 'balanceToBePaid', label: 'Balance', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
  ]

  const handleExport = () => {
    if (!canExport) {
      toast.error('You do not have permission to export')
      return
    }

    const dataToExport = filteredData.map(item => ({
      'Member ID': item.memberId,
      'Name': item.name,
      'Mobile': item.mobile || '-',
      'Bank Account No': item.bank?.accountNo || '-',
      'Bank Name': item.bank?.bankName || '-',
      'Branch': item.bank?.branch || '-',
      'IFSC Code': item.bank?.ifsc || '-',
      'Balance': item.balanceToBePaid || 0
    }))

    exportToCSV(dataToExport, Object.keys(dataToExport[0] || {}).map(key => ({ key, label: key })), 
      generateFilename('payout-report', fromDate, toDate))
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Payout Report</h1>

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
          <>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showZeroBalance"
                checked={showZeroBalance}
                onChange={(e) => setShowZeroBalance(e.target.checked)}
                className="w-4 h-4 text-primary rounded"
              />
              <label htmlFor="showZeroBalance" className="text-sm text-gray-400">
                Show Zero Balance
              </label>
            </div>
            <div className="flex items-end">
              <button
                onClick={loadData}
                className="btn-primary w-full"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Find'}
              </button>
            </div>
          </>
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
                        <Link
                          to={`/admin/users/${row.id}`}
                          className="btn-secondary text-sm flex items-center gap-1"
                        >
                          <Eye size={14} />
                          View User
                        </Link>
                        {row.balanceToBePaid > 0 && (
                          <button
                            className="btn-primary text-sm flex items-center gap-1"
                            onClick={() => {
                              // TODO: Open payment form modal
                              toast.info('Payment form will open here')
                            }}
                          >
                            <IndianRupee size={14} />
                            Pay Now
                          </button>
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
    </div>
  )
}

