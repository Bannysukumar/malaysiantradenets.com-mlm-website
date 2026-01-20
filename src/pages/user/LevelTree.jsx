import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { Search, TreePine, List, ChevronDown, ChevronRight, ArrowUp } from 'lucide-react'
import TreeNode from '../../components/tree/TreeNode'

export default function UserLevelTree() {
  const { user, userData } = useAuth()
  const navigate = useNavigate()
  const [rootNode, setRootNode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('compact') // Default to compact for users
  const [expanded, setExpanded] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedNode, setHighlightedNode] = useState(null)
  const [maxDepth, setMaxDepth] = useState(5)

  // Load user's own tree on mount
  useEffect(() => {
    if (user?.uid) {
      loadUserTree(user.uid)
    }
  }, [user?.uid])

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
      toast.error('Error loading your downline tree')
    } finally {
      setLoading(false)
    }
  }

  const buildTreeFromList = (downlineList, rootUid) => {
    if (!rootUid || !downlineList || downlineList.length === 0) {
      return {
        uid: rootUid,
        name: userData?.name || 'You',
        userId: userData?.userId,
        status: userData?.status,
        programType: userData?.programType,
        packageName: userData?.packageName,
        children: []
      }
    }

    const userMap = new Map()
    downlineList.forEach(user => {
      userMap.set(user.uid, {
        ...user,
        children: []
      })
    })

    const root = {
      uid: rootUid,
      name: userData?.name || 'You',
      userId: userData?.userId,
      status: userData?.status,
      programType: userData?.programType,
      packageName: userData?.packageName,
      directsCount: downlineList.filter(u => u.referredByUid === rootUid).length,
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

  // Search within downline
  const searchInDownline = async () => {
    if (!searchTerm || searchTerm.length < 2) {
      setHighlightedNode(null)
      return
    }

    const searchLower = searchTerm.toLowerCase()
    
    // Recursive search function
    const findNode = (node, searchTerm) => {
      if (!node) return null

      const matches = 
        node.name?.toLowerCase().includes(searchLower) ||
        node.userId?.toLowerCase().includes(searchLower) ||
        node.email?.toLowerCase().includes(searchLower) ||
        node.phone?.includes(searchTerm)

      if (matches) {
        return node
      }

      if (node.children) {
        for (const child of node.children) {
          const found = findNode(child, searchTerm)
          if (found) return found
        }
      }

      return null
    }

    const found = findNode(rootNode, searchTerm)
    if (found) {
      setHighlightedNode(found.uid)
      // Expand path to found node
      expandPathToNode(found.uid)
      toast.success('User found in your downline!')
    } else {
      toast.error('User not found in your downline')
      setHighlightedNode(null)
    }
  }

  const expandPathToNode = (targetUid) => {
    const expandPath = (node, targetUid, path = []) => {
      if (!node) return null
      
      if (node.uid === targetUid) {
        return path
      }

      if (node.children) {
        for (const child of node.children) {
          const result = expandPath(child, targetUid, [...path, node.uid])
          if (result) return result
        }
      }

      return null
    }

    const path = expandPath(rootNode, targetUid)
    if (path) {
      const newExpanded = { ...expanded }
      path.forEach(uid => {
        newExpanded[uid] = true
      })
      newExpanded[targetUid] = true
      setExpanded(newExpanded)
    }
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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TreePine className="text-primary" size={32} />
          My Downline Tree
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
          <div className="flex-1 flex gap-2 relative">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
              type="text"
              placeholder="Search in your downline (User ID, Name, Email)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  searchInDownline()
                }
              }}
                className="input-field pl-10 flex-1"
              />
            </div>
            <button
              onClick={searchInDownline}
              className="btn-primary"
            >
              Find
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={expandAll} className="btn-secondary">
              Expand All
            </button>
            <button onClick={collapseAll} className="btn-secondary">
              Collapse All
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
              if (user?.uid) {
                loadUserTree(user.uid)
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
                onNodeClick={null}
                isAdmin={false}
                showWallet={false}
                highlighted={highlightedNode === rootNode.uid}
              />
            </div>
          ) : (
            <CompactTreeView
              node={rootNode}
              expanded={expanded}
              onToggleExpand={toggleExpand}
              highlighted={highlightedNode}
            />
          )}
        </div>
      ) : (
        <div className="card">
          <div className="text-center py-12">
            <TreePine className="text-gray-400 mx-auto mb-4" size={48} />
            <p className="text-gray-400 text-lg mb-2">No downline yet</p>
            <p className="text-gray-500 text-sm">Start referring users to build your network!</p>
          </div>
        </div>
      )}

      {/* Back to Top Button (Mobile) */}
      <button
        onClick={scrollToTop}
        className="fixed bottom-6 right-6 md:hidden p-3 bg-primary rounded-full shadow-lg hover:bg-primary/80 transition-colors"
        aria-label="Back to top"
      >
        <ArrowUp size={20} />
      </button>
    </div>
  )
}

// Compact List Tree View
function CompactTreeView({ node, expanded, onToggleExpand, highlighted }) {
  if (!node) return null

  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expanded[node.uid]
  const isHighlighted = highlighted === node.uid

  return (
    <div className={`space-y-1 ${isHighlighted ? 'bg-yellow-500/20 rounded p-2' : ''}`}>
      <div className="flex items-center gap-2 p-2 rounded hover:bg-dark-lighter">
        {hasChildren && (
          <button
            onClick={() => onToggleExpand && onToggleExpand(node.uid)}
            className="text-primary"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className={`font-semibold mb-1 ${isHighlighted ? 'text-yellow-400' : ''}`}>
            {node.name}
          </div>
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
        {node.programType && (
          <span className={`badge ${node.programType === 'investor' ? 'bg-blue-500' : 'bg-purple-500'} text-xs`}>
            {node.programType === 'investor' ? 'Investor' : 'Leader'}
          </span>
        )}
      </div>
      {isExpanded && hasChildren && (
        <div className="ml-6">
          {node.children.map(child => (
            <CompactTreeView
              key={child.uid}
              node={child}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              highlighted={highlighted}
            />
          ))}
        </div>
      )}
    </div>
  )
}

