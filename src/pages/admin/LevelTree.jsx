import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { Search, Users, TreePine, List, ChevronDown, ChevronUp, X, Copy } from 'lucide-react'
import TreeNode from '../../components/tree/TreeNode'
import { useAuth } from '../../contexts/AuthContext'

export default function AdminLevelTree() {
  const { user: currentUser, userData } = useAuth()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [rootNode, setRootNode] = useState(null)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState('tree') // 'tree' or 'compact'
  const [expanded, setExpanded] = useState({})
  const [selectedNode, setSelectedNode] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [maxDepth, setMaxDepth] = useState(5)
  const [nodeCache, setNodeCache] = useState({})

  // Search users
  useEffect(() => {
    if (searchTerm.length < 2) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    const searchUsers = async () => {
      try {
        const searchLower = searchTerm.toLowerCase()
        const usersRef = collection(db, 'users')
        
        // Search by User ID
        if (searchTerm.toUpperCase().startsWith('MTN')) {
          const userIdIndexRef = doc(db, 'userIdIndex', searchTerm.toUpperCase())
          const indexDoc = await getDoc(userIdIndexRef)
          if (indexDoc.exists()) {
            const indexData = indexDoc.data()
            const userDoc = await getDoc(doc(db, 'users', indexData.uid))
            if (userDoc.exists()) {
              setSearchResults([{ id: userDoc.id, ...userDoc.data() }])
              setShowSearchResults(true)
              return
            }
          }
        }

        // Search by email, name, phone
        const queries = [
          query(usersRef, where('emailLower', '>=', searchLower), where('emailLower', '<=', searchLower + '\uf8ff')),
          query(usersRef, where('userIdLower', '>=', searchLower), where('userIdLower', '<=', searchLower + '\uf8ff'))
        ]

        const results = []
        for (const q of queries) {
          const snapshot = await getDocs(q)
          snapshot.forEach(doc => {
            const data = doc.data()
            if (
              data.email?.toLowerCase().includes(searchLower) ||
              data.name?.toLowerCase().includes(searchLower) ||
              data.phone?.includes(searchTerm) ||
              data.userId?.toLowerCase().includes(searchLower)
            ) {
              results.push({ id: doc.id, ...data })
            }
          })
        }

        // Remove duplicates
        const uniqueResults = Array.from(new Map(results.map(r => [r.id, r])).values())
        setSearchResults(uniqueResults.slice(0, 10))
        setShowSearchResults(true)
      } catch (error) {
        console.error('Search error:', error)
      }
    }

    const timeoutId = setTimeout(searchUsers, 300)
    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  const loadUserTree = async (userId) => {
    if (!userId) return

    setLoading(true)
    try {
      const functions = getFunctions()
      const getTree = httpsCallable(functions, 'getUserDownlineTree')
      const getList = httpsCallable(functions, 'getUserDownlineList')

      const [treeResult, listResult] = await Promise.all([
        getTree({ userId, maxDepth }),
        getList({ userId, limit: 500 })
      ])

      if (treeResult.data?.tree) {
        setRootNode(treeResult.data.tree)
        // Expand first level by default
        setExpanded({ [treeResult.data.tree.uid]: true })
      } else {
        // Build tree from list if tree not available
        const tree = buildTreeFromList(listResult.data?.downline || [], userId)
        setRootNode(tree)
        if (tree) {
          setExpanded({ [tree.uid]: true })
        }
      }
    } catch (error) {
      console.error('Error loading tree:', error)
      toast.error('Error loading user tree')
    } finally {
      setLoading(false)
    }
  }

  const buildTreeFromList = (downlineList, rootUid) => {
    if (!rootUid || !downlineList || downlineList.length === 0) {
      // Fetch root user
      return null
    }

    // Find root user in list or fetch it
    const rootUser = downlineList.find(u => u.uid === rootUid) || downlineList[0]
    
    const userMap = new Map()
    downlineList.forEach(user => {
      userMap.set(user.uid, {
        ...user,
        children: []
      })
    })

    const root = userMap.get(rootUid) || {
      uid: rootUid,
      name: 'Root User',
      children: []
    }

    downlineList.forEach(user => {
      if (user.referredByUid && user.referredByUid !== rootUid) {
        const parent = userMap.get(user.referredByUid)
        if (parent) {
          parent.children.push(userMap.get(user.uid))
        }
      } else if (user.referredByUid === rootUid) {
        root.children.push(userMap.get(user.uid))
      }
    })

    return root
  }

  const handleSearchSelect = (user) => {
    setSearchTerm('')
    setShowSearchResults(false)
    loadUserTree(user.id)
  }

  const toggleExpand = (uid) => {
    setExpanded(prev => ({
      ...prev,
      [uid]: !prev[uid]
    }))
  }

  const expandAll = () => {
    if (!rootNode) return
    
    const expandNode = (node) => {
      if (!node || !node.uid) return {}
      const expanded = { [node.uid]: true }
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => {
          if (child && child.uid) {
            Object.assign(expanded, expandNode(child))
          }
        })
      }
      return expanded
    }
    const allExpanded = expandNode(rootNode)
    setExpanded(allExpanded)
  }

  const collapseAll = () => {
    setExpanded({})
  }

  const handleNodeClick = (node) => {
    setSelectedNode(node)
    navigate(`/admin/users/${node.uid}`)
  }

  const loadMyTree = () => {
    if (currentUser?.uid) {
      loadUserTree(currentUser.uid)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TreePine className="text-primary" size={32} />
          Level Tree
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('tree')}
            className={`btn-secondary flex items-center gap-2 ${viewMode === 'tree' ? 'bg-primary' : ''}`}
          >
            <TreePine size={18} />
            Tree View
          </button>
          <button
            onClick={() => setViewMode('compact')}
            className={`btn-secondary flex items-center gap-2 ${viewMode === 'compact' ? 'bg-primary' : ''}`}
          >
            <List size={18} />
            Compact View
          </button>
        </div>
      </div>

      {/* Search and Controls */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by User ID, Email, Phone, or Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-dark-light border border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSearchSelect(user)}
                    className="w-full text-left px-4 py-2 hover:bg-dark-lighter flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold">{user.name}</div>
                      <div className="text-sm text-gray-400">
                        {user.userId} • {user.email}
                      </div>
                    </div>
                    <Users size={16} className="text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={loadMyTree} className="btn-secondary">
              My Root
            </button>
            <button onClick={expandAll} className="btn-secondary">
              Expand All
            </button>
            <button onClick={collapseAll} className="btn-secondary">
              Collapse All
            </button>
            <button
              onClick={() => {
                setRootNode(null)
                setSearchTerm('')
              }}
              className="btn-secondary"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Depth Filter */}
        <div className="mt-4 flex items-center gap-4">
          <label className="text-sm text-gray-400">Max Depth:</label>
          <select
            value={maxDepth}
            onChange={(e) => {
              setMaxDepth(Number(e.target.value))
              if (rootNode) {
                loadUserTree(rootNode.uid)
              }
            }}
            className="input-field text-sm"
          >
            <option value={3}>3 Levels</option>
            <option value={5}>5 Levels</option>
            <option value={10}>10 Levels</option>
            <option value={25}>25 Levels</option>
          </select>
        </div>
      </div>

      {/* Tree Display */}
      {loading ? (
        <div className="card">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      ) : rootNode ? (
        <div className="card">
          {viewMode === 'tree' ? (
            <div className="space-y-2">
              <TreeNode
                node={rootNode}
                depth={0}
                expanded={expanded}
                onToggleExpand={toggleExpand}
                onNodeClick={handleNodeClick}
                isAdmin={true}
                showWallet={true}
              />
            </div>
          ) : (
            <CompactTreeView
              node={rootNode}
              expanded={expanded}
              onToggleExpand={toggleExpand}
              onNodeClick={handleNodeClick}
            />
          )}
        </div>
      ) : (
        <div className="card">
          <div className="text-center py-12">
            <Users className="text-gray-400 mx-auto mb-4" size={48} />
            <p className="text-gray-400 text-lg mb-2">No tree loaded</p>
            <p className="text-gray-500 text-sm">Search for a user to view their downline tree</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Compact List Tree View
function CompactTreeView({ node, expanded, onToggleExpand, onNodeClick }) {
  if (!node) return null

  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expanded[node.uid]

  return (
    <div className="space-y-1">
      <div
        className="flex items-center gap-2 p-2 rounded hover:bg-dark-lighter cursor-pointer"
        onClick={() => onNodeClick && onNodeClick(node)}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand && onToggleExpand(node.uid)
            }}
            className="text-primary"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold mb-1">{node.name}</div>
          {node.userId ? (
            <div className="text-sm font-mono text-primary font-semibold mb-1">
              {node.userId}
            </div>
          ) : (
            <div className="text-xs text-gray-500 italic mb-1">User ID: Generating...</div>
          )}
          {node.email && (
            <div className="text-xs text-gray-500">{node.email}</div>
          )}
        </div>
        <span className="badge bg-green-500 text-xs">{node.status}</span>
      </div>
      {isExpanded && hasChildren && (
        <div className="ml-6">
          {node.children.map(child => (
            <CompactTreeView
              key={child.uid}
              node={child}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

