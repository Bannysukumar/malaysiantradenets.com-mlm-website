import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useCollection } from '../../../hooks/useFirestore'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../../../config/firebase'
import { formatCurrency, formatDate } from '../../../utils/helpers'
import toast from 'react-hot-toast'
import { Users, Search, ChevronDown, ChevronRight } from 'lucide-react'

export default function LevelReport() {
  const { userData, user } = useAuth()
  const [inputUserId, setInputUserId] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [levels, setLevels] = useState({})
  const [expandedLevels, setExpandedLevels] = useState(new Set([1]))
  const [levelSearchTerms, setLevelSearchTerms] = useState({})
  const [loading, setLoading] = useState(false)
  const { data: userPackages } = useCollection('userPackages', [])

  // Initialize with current user's ID
  useEffect(() => {
    if (user || userData) {
      const currentUserId = userData?.userId || user?.uid
      if (currentUserId) {
        setInputUserId(currentUserId)
        setSelectedUserId(currentUserId)
      }
    }
  }, [user, userData])

  // Get active packages map for business volume
  const activePackagesMap = useMemo(() => {
    const map = {}
    userPackages.forEach(pkg => {
      if (pkg.status === 'active' && pkg.userId) {
        const volume = pkg.amount || pkg.inrPrice || 0
        if (!map[pkg.userId] || volume > (map[pkg.userId] || 0)) {
          map[pkg.userId] = volume
        }
      }
    })
    return map
  }, [userPackages])

  // Security check: Ensure user can only view their own tree
  const validateUserId = (userId) => {
    const currentUserUid = user?.uid || userData?.id
    const currentUserId = userData?.userId
    
    // Allow if it matches current user's UID or User ID
    if (userId === currentUserUid || userId === currentUserId) {
      return true
    }
    
    // Try to find user by userId and check if it matches current user
    return false
  }

  const loadLevelData = async (rootUserId, maxLevel = 5) => {
    if (!userData) {
      toast.error('User data not available')
      return
    }
    
    setLoading(true)
    try {
      // Security: Only allow viewing own tree
      if (!validateUserId(rootUserId)) {
        toast.error('You can only view your own team tree')
        const currentUserId = userData?.userId || userData?.uid || userData?.id
        if (currentUserId) {
          setInputUserId(currentUserId)
        }
        return
      }

      const currentUserUid = user?.uid || userData?.id
      
      if (!currentUserUid) {
        toast.error('User ID not found')
        setLoading(false)
        return
      }
      
      const levelsData = {}

      // Level 1: Direct referrals
      const level1Ref = collection(db, 'users')
      const level1Query = query(level1Ref, where('referredByUid', '==', currentUserUid))
      const level1Snapshot = await getDocs(level1Query)
      
      const level1Members = []
      level1Snapshot.forEach(doc => {
        const data = doc.data()
        level1Members.push({
          id: doc.id,
          userId: data.userId || doc.id,
          name: data.name || 'N/A',
          mobile: data.phone || 'N/A',
          sponsorId: data.referredByUid || currentUserUid,
          status: data.status || 'active',
          joinDate: data.createdAt,
          businessVolume: activePackagesMap[doc.id] || 0
        })
      })
      levelsData[1] = level1Members

      // Load subsequent levels lazily (only if level is expanded)
      for (let level = 2; level <= maxLevel; level++) {
        if (!expandedLevels.has(level)) {
          continue // Skip if level is not expanded
        }

        const prevLevelMembers = levelsData[level - 1] || []
        const currentLevelMembers = []

        // For each member in previous level, get their direct referrals
        for (const member of prevLevelMembers) {
          try {
            if (!member.id) continue // Skip if member ID is missing
            
            const memberRef = collection(db, 'users')
            const memberQuery = query(memberRef, where('referredByUid', '==', member.id))
            const memberSnapshot = await getDocs(memberQuery)
            
            memberSnapshot.forEach(doc => {
              const data = doc.data()
              currentLevelMembers.push({
                id: doc.id,
                userId: data.userId || doc.id,
                name: data.name || 'N/A',
                mobile: data.phone || 'N/A',
                sponsorId: data.referredByUid || member.id,
                status: data.status || 'active',
                joinDate: data.createdAt,
                businessVolume: activePackagesMap[doc.id] || 0
              })
            })
          } catch (error) {
            console.error(`Error loading level ${level} for member ${member.id}:`, error)
          }
        }

        if (currentLevelMembers.length > 0) {
          levelsData[level] = currentLevelMembers
        }
      }

      setLevels(levelsData)
    } catch (error) {
      console.error('Error loading level data:', error)
      toast.error('Error loading level data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedUserId && (user || userData)) {
      const currentUserUid = user?.uid || userData?.id
      if (currentUserUid) {
        loadLevelData(selectedUserId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, expandedLevels, user, userData])

  const handleGetData = () => {
    if (!inputUserId.trim()) {
      toast.error('Please enter a User ID')
      return
    }

    // Security check
    if (!validateUserId(inputUserId)) {
      toast.error('You can only view your own team tree')
      setInputUserId(userData?.userId || userData?.uid || userData?.id || '')
      return
    }

    setSelectedUserId(inputUserId)
  }

  const toggleLevel = (level) => {
    const newExpanded = new Set(expandedLevels)
    if (newExpanded.has(level)) {
      newExpanded.delete(level)
    } else {
      newExpanded.add(level)
    }
    setExpandedLevels(newExpanded)
  }

  const filterLevelMembers = (members, searchTerm) => {
    if (!searchTerm) return members
    const searchLower = searchTerm.toLowerCase()
    return members.filter(member =>
      member.userId?.toLowerCase().includes(searchLower) ||
      member.name?.toLowerCase().includes(searchLower) ||
      member.mobile?.includes(searchTerm) ||
      member.sponsorId?.toLowerCase().includes(searchLower)
    )
  }

  const getStatusBadge = (status) => {
    const statusValue = status || 'active'
    if (statusValue === 'ACTIVE_INVESTOR' || statusValue === 'ACTIVE_LEADER' || statusValue === 'active') {
      return <span className="badge bg-green-500 text-xs">Active</span>
    }
    if (statusValue === 'PENDING_ACTIVATION') {
      return <span className="badge bg-yellow-500 text-xs">Pending</span>
    }
    if (statusValue === 'blocked' || statusValue === 'AUTO_BLOCKED') {
      return <span className="badge bg-red-500 text-xs">Blocked</span>
    }
    return <span className="badge bg-gray-500 text-xs">Inactive</span>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <Users className="text-primary" size={32} />
        Level Report
      </h1>

      {/* Input Section */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2">Enter User ID</label>
            <input
              type="text"
              value={inputUserId}
              onChange={(e) => setInputUserId(e.target.value)}
              placeholder="Enter User ID"
              className="input-field w-full"
              disabled={true} // Locked to current user for security
            />
            <p className="text-xs text-gray-400 mt-1">Showing your team tree</p>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleGetData}
              disabled={loading || !inputUserId.trim()}
              className="btn-primary"
            >
              {loading ? 'Loading...' : 'Get Data'}
            </button>
          </div>
        </div>
      </div>

      {/* Level Sections */}
      {Object.keys(levels).length === 0 && !loading && selectedUserId && (
        <div className="card text-center py-12">
          <p className="text-gray-400">No team members found</p>
        </div>
      )}

      {[1, 2, 3, 4, 5].map(level => {
        const levelMembers = levels[level] || []
        const searchTerm = levelSearchTerms[level] || ''
        const filteredMembers = filterLevelMembers(levelMembers, searchTerm)
        const isExpanded = expandedLevels.has(level)

        if (!isExpanded && level > 1 && levelMembers.length === 0) {
          return (
            <div key={level} className="card mb-4">
              <button
                onClick={() => toggleLevel(level)}
                className="w-full flex items-center justify-between p-4"
              >
                <h2 className="text-xl font-bold">Level {level}</h2>
                <ChevronRight size={20} />
              </button>
            </div>
          )
        }

        return (
          <div key={level} className="card mb-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <button
                onClick={() => toggleLevel(level)}
                className="flex items-center gap-2"
              >
                {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                <h2 className="text-xl font-bold">Level {level}</h2>
              </button>
              <span className="text-primary font-semibold">Total: {levelMembers.length}</span>
            </div>

            {isExpanded && (
              <>
                {/* Search for this level */}
                <div className="p-4 border-b border-gray-700">
                  <div className="flex items-center gap-2">
                    <Search className="text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder={`Search Level ${level}...`}
                      value={searchTerm}
                      onChange={(e) => setLevelSearchTerms({...levelSearchTerms, [level]: e.target.value})}
                      className="input-field flex-1"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-4 px-4 font-semibold">S.No</th>
                        <th className="text-left py-4 px-4 font-semibold">Join Date</th>
                        <th className="text-left py-4 px-4 font-semibold">User ID</th>
                        <th className="text-left py-4 px-4 font-semibold">Name</th>
                        <th className="text-left py-4 px-4 font-semibold">Business Volume</th>
                        <th className="text-left py-4 px-4 font-semibold">Mobile</th>
                        <th className="text-left py-4 px-4 font-semibold">Sponsor ID</th>
                        <th className="text-left py-4 px-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-gray-400">
                            {levelMembers.length === 0 ? 'No members at this level' : 'No results found'}
                          </td>
                        </tr>
                      ) : (
                        filteredMembers.map((member, index) => (
                          <tr key={member.id} className={`border-b border-gray-800 ${index % 2 === 0 ? 'bg-dark-lighter' : ''} hover:bg-dark-light`}>
                            <td className="py-4 px-4">{index + 1}</td>
                            <td className="py-4 px-4">{member.joinDate ? formatDate(member.joinDate) : 'N/A'}</td>
                            <td className="py-4 px-4 font-mono text-primary">{member.userId || 'N/A'}</td>
                            <td className="py-4 px-4">{member.name || 'N/A'}</td>
                            <td className="py-4 px-4">{formatCurrency(member.businessVolume || 0, 'INR')}</td>
                            <td className="py-4 px-4">{member.mobile || 'N/A'}</td>
                            <td className="py-4 px-4 font-mono text-sm">{member.sponsorId || 'N/A'}</td>
                            <td className="py-4 px-4">{getStatusBadge(member.status)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

