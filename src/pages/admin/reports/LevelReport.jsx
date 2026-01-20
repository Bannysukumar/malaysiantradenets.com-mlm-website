import { useState, useMemo } from 'react'
import { useCollection } from '../../../hooks/useFirestore'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../../../config/firebase'
import ReportFilters from '../../../components/reports/ReportFilters'
import ReportTable from '../../../components/reports/ReportTable'
import { exportToCSV, generateFilename } from '../../../utils/export'
import { formatDate, formatCurrency } from '../../../utils/helpers'
import { useAuth } from '../../../contexts/AuthContext'
import { hasActionPermission } from '../../../utils/permissions'
import toast from 'react-hot-toast'
import { Search } from 'lucide-react'

export default function LevelReport() {
  const { userData } = useAuth()
  const [userId, setUserId] = useState('')
  const [selectedLevel, setSelectedLevel] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [levelData, setLevelData] = useState({})
  const [rootUser, setRootUser] = useState(null)

  const canExport = userData?.role === 'superAdmin' || 
                   userData?.role === 'admin' ||
                   hasActionPermission(userData, 'reports', 'export')

  const handleGetData = async () => {
    if (!userId.trim()) {
      toast.error('Please enter a User ID')
      return
    }

    setLoading(true)
    try {
      // Find user by User ID
      const userIdIndexRef = doc(db, 'userIdIndex', userId.toUpperCase())
      const indexDoc = await getDoc(userIdIndexRef)
      
      if (!indexDoc.exists()) {
        toast.error('User not found')
        setLoading(false)
        return
      }

      const indexData = indexDoc.data()
      const userDoc = await getDoc(doc(db, 'users', indexData.uid))
      
      if (!userDoc.exists()) {
        toast.error('User not found')
        setLoading(false)
        return
      }

      const userData = userDoc.data()
      setRootUser({ uid: indexData.uid, ...userData })

      // Build level tree
      const levels = await buildLevelTree(indexData.uid)
      setLevelData(levels)
    } catch (error) {
      console.error('Error loading level data:', error)
      toast.error('Error loading level data')
    } finally {
      setLoading(false)
    }
  }

  const buildLevelTree = async (rootUid, maxLevel = 25) => {
    const levels = {}
    
    // Level 0 (root)
    const rootDoc = await getDoc(doc(db, 'users', rootUid))
    if (rootDoc.exists()) {
      levels[0] = [{
        id: rootUid,
        ...rootDoc.data(),
        level: 0
      }]
    }

    // Get all users
    const allUsersSnapshot = await getDocs(collection(db, 'users'))
    const allUsers = {}
    allUsersSnapshot.forEach(doc => {
      allUsers[doc.id] = { id: doc.id, ...doc.data() }
    })

    // Get all user packages for business volume calculation
    const packagesSnapshot = await getDocs(collection(db, 'userPackages'))
    const userPackages = {}
    packagesSnapshot.forEach(doc => {
      const pkg = doc.data()
      const uid = pkg.userId
      if (!userPackages[uid]) {
        userPackages[uid] = []
      }
      if (pkg.status === 'active') {
        userPackages[uid].push(pkg)
      }
    })

    // Build level structure
    for (let level = 1; level <= maxLevel; level++) {
      const prevLevel = levels[level - 1] || []
      const currentLevel = []

      for (const user of prevLevel) {
        const children = Object.values(allUsers).filter(u => 
          u.referredByUid === user.id
        )
        currentLevel.push(...children.map(c => {
          // Calculate business volume (sum of active packages)
          const packages = userPackages[c.id] || []
          const businessVolume = packages.reduce((sum, p) => sum + (p.amount || p.inrPrice || 0), 0)
          return { ...c, level, businessVolume }
        }))
      }

      if (currentLevel.length > 0) {
        levels[level] = currentLevel
      } else {
        break
      }
    }

    return levels
  }

  const getFilteredLevelData = () => {
    if (selectedLevel === 'all') {
      return Object.values(levelData).flat()
    }
    return levelData[parseInt(selectedLevel)] || []
  }

  const filteredData = useMemo(() => {
    let data = getFilteredLevelData()
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      data = data.filter(item => 
        item.name?.toLowerCase().includes(searchLower) ||
        item.userId?.toLowerCase().includes(searchLower) ||
        item.phone?.includes(searchTerm) ||
        item.email?.toLowerCase().includes(searchLower)
      )
    }

    return data
  }, [levelData, selectedLevel, searchTerm])

  const columns = [
    { key: 'sno', label: 'S.No', sortable: false, render: (_, row, index) => index + 1 },
    { key: 'createdAt', label: 'Join Date', sortable: true, render: (val) => formatDate(val) },
    { key: 'userId', label: 'User ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'businessVolume', label: 'Business Volume', sortable: true, render: (val) => formatCurrency(val || 0, 'INR') },
    { key: 'phone', label: 'Mobile', sortable: true },
    { key: 'sponsorId', label: 'Sponsor ID', sortable: true, render: (_, row) => {
      const sponsor = row.referredByUid
      // Find sponsor's userId
      return sponsor || '-'
    }},
    { key: 'status', label: 'Status', sortable: true, render: (val) => {
      const isActive = val === 'active' || val === 'ACTIVE_INVESTOR' || val === 'ACTIVE_LEADER'
      return (
        <span className={`badge ${isActive ? 'bg-green-500' : 'bg-red-500'} text-xs`}>
          {isActive ? 'Active' : 'Inactive'}
        </span>
      )
    }},
  ]

  const handleExport = () => {
    if (!canExport) {
      toast.error('You do not have permission to export')
      return
    }

    const dataToExport = filteredData.map((item, index) => ({
      'S.No': index + 1,
      'Join Date': formatDate(item.createdAt),
      'User ID': item.userId || '-',
      'Name': item.name || '-',
      'Business Volume': item.businessVolume || 0,
      'Mobile': item.phone || '-',
      'Sponsor ID': item.referredByUid || '-',
      'Status': item.status === 'active' || item.status === 'ACTIVE_INVESTOR' || item.status === 'ACTIVE_LEADER' ? 'Active' : 'Inactive'
    }))

    exportToCSV(dataToExport, Object.keys(dataToExport[0] || {}).map(key => ({ key, label: key })), 
      generateFilename('level-report'))
  }

  const levelOptions = ['all', ...Object.keys(levelData).filter(k => k !== '0').map(k => parseInt(k)).sort((a, b) => a - b)]

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Level Report</h1>

      {/* User ID Input */}
      <div className="card mb-6">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-semibold mb-2">Enter User ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter User ID (e.g., MTN123456)"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">Level</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="input-field"
              disabled={Object.keys(levelData).length === 0}
            >
              <option value="all">All Levels</option>
              {levelOptions.filter(l => l !== 'all').map(level => (
                <option key={level} value={level}>Level {level}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGetData}
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Get Data'}
          </button>
        </div>
      </div>

      {/* Filters */}
      {Object.keys(levelData).length > 0 && (
        <ReportFilters
          onSearch={setSearchTerm}
          showDateRange={false}
          showExport={true}
          canExport={canExport}
          onExport={handleExport}
        />
      )}

      {/* Level Sections */}
      {Object.keys(levelData).length > 0 && (
        <div className="space-y-6">
          {selectedLevel === 'all' ? (
            Object.entries(levelData).map(([level, users]) => {
              if (parseInt(level) === 0) return null // Skip root
              const filtered = users.filter(item => {
                if (!searchTerm) return true
                const searchLower = searchTerm.toLowerCase()
                return item.name?.toLowerCase().includes(searchLower) ||
                       item.userId?.toLowerCase().includes(searchLower) ||
                       item.phone?.includes(searchTerm)
              })
              
              if (filtered.length === 0) return null

              return (
                <div key={level} className="card">
                  <div className="mb-4">
                    <h2 className="text-xl font-bold">Level {level}</h2>
                    <p className="text-sm text-gray-400">Total {filtered.length}</p>
                  </div>
                  <ReportTable
                    columns={columns}
                    data={filtered}
                    pagination={true}
                  />
                </div>
              )
            })
          ) : (
            <ReportTable
              columns={columns}
              data={filteredData}
              pagination={true}
            />
          )}
        </div>
      )}

      {Object.keys(levelData).length === 0 && !loading && (
        <div className="card text-center py-12">
          <p className="text-gray-400">Enter a User ID and click "Get Data" to view level report</p>
        </div>
      )}
    </div>
  )
}

