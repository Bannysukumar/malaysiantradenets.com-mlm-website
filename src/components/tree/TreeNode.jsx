import { useState } from 'react'
import { Copy, ChevronDown, ChevronRight, Eye, User } from 'lucide-react'
import { getAvatarUrl, getInitials } from '../../utils/avatar'
import { formatCurrency } from '../../utils/helpers'
import toast from 'react-hot-toast'

export default function TreeNode({ 
  node, 
  depth = 0, 
  expanded = {}, 
  onToggleExpand, 
  onNodeClick,
  isAdmin = false,
  showWallet = false,
  highlighted = false
}) {
  const [imageError, setImageError] = useState(false)
  const [copied, setCopied] = useState(false)
  
  const hasChildren = node.children && node.children.length > 0
  const isExpanded = expanded[node.uid] || false
  const avatarUrl = getAvatarUrl(node, 60)
  const initials = getInitials(node.name)
  
  const copyUserId = () => {
    if (node.userId) {
      navigator.clipboard.writeText(node.userId)
      setCopied(true)
      toast.success('User ID copied!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      'ACTIVE_INVESTOR': { label: 'ACTIVE', color: 'bg-green-500' },
      'ACTIVE_LEADER': { label: 'ACTIVE', color: 'bg-green-500' },
      'PENDING_ACTIVATION': { label: 'PENDING', color: 'bg-yellow-500' },
      'blocked': { label: 'BLOCKED', color: 'bg-red-500' },
      'AUTO_BLOCKED': { label: 'BLOCKED', color: 'bg-red-500' },
      'CAP_REACHED': { label: 'CAP REACHED', color: 'bg-orange-500' },
      'active': { label: 'ACTIVE', color: 'bg-green-500' }
    }
    const statusInfo = statusMap[status] || { label: status || 'UNKNOWN', color: 'bg-gray-500' }
    return (
      <span className={`badge ${statusInfo.color} text-xs`}>
        {statusInfo.label}
      </span>
    )
  }

  const getProgramBadge = (programType) => {
    if (!programType) return null
    const isInvestor = programType === 'investor' || programType === 'ACTIVE_INVESTOR'
    return (
      <span className={`badge ${isInvestor ? 'bg-blue-500' : 'bg-purple-500'} text-xs`}>
        {isInvestor ? 'Investor' : 'Leader'}
      </span>
    )
  }

  return (
    <div className="relative">
      <div 
        className={`
          flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer
          ${highlighted ? 'bg-yellow-500/20 border-yellow-500' : 'border-gray-700 hover:bg-dark-lighter'}
          ${depth > 0 ? 'ml-6' : ''}
        `}
        onClick={() => onNodeClick && onNodeClick(node)}
      >
        {/* Avatar */}
        <div className="flex-shrink-0 relative">
          {!imageError ? (
            <img
              src={avatarUrl}
              alt={node.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-gray-600"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border-2 border-gray-600">
              <span className="text-primary font-semibold text-sm">{initials}</span>
            </div>
          )}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand && onToggleExpand(node.uid)
              }}
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-xs hover:bg-primary/80"
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name Row */}
          <div className="mb-1">
            <span className={`font-semibold text-base ${highlighted ? 'text-yellow-400' : 'text-white'}`}>
              {node.name || 'N/A'}
            </span>
          </div>
          
          {/* User ID Row - Prominent */}
          <div className="mb-1.5">
            {node.userId ? (
              <span className="text-sm font-mono text-primary font-semibold">
                {node.userId}
              </span>
            ) : (
              <span className="text-xs text-gray-500 italic">User ID: Generating...</span>
            )}
          </div>
          
          {/* Email Row */}
          {node.email && (
            <div className="mb-2 text-xs text-gray-400">
              <span className="truncate">{node.email}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {getStatusBadge(node.status)}
            {getProgramBadge(node.programType)}
            {node.packageName && node.packageName !== 'None' && (
              <span className="badge bg-gray-600 text-xs">{node.packageName}</span>
            )}
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>Directs: {node.directsCount || 0}</span>
            <span>Downline: {node.downlineCount || 0}</span>
            {showWallet && isAdmin && (
              <span>Wallet: {formatCurrency(node.walletAvailable || 0)}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {node.userId && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                copyUserId()
              }}
              className="p-1.5 text-gray-400 hover:text-primary transition-colors"
              title="Copy User ID"
            >
              {copied ? (
                <span className="text-green-500 text-xs">✓</span>
              ) : (
                <Copy size={14} />
              )}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onNodeClick && onNodeClick(node)
              }}
              className="p-1.5 text-gray-400 hover:text-primary transition-colors"
              title="View Details"
            >
              <Eye size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="mt-2 ml-6 border-l-2 border-gray-700 pl-4 space-y-2">
          {node.children.map((child) => (
              <TreeNode
                key={child.uid}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                onToggleExpand={onToggleExpand}
                onNodeClick={onNodeClick}
                isAdmin={isAdmin}
                showWallet={showWallet}
                highlighted={highlighted === child.uid}
              />
          ))}
        </div>
      )}
    </div>
  )
}

