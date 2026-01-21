// Permission checking utility

// Permission mapping for routes
export const PERMISSION_MAP = {
  '/admin/dashboard': 'dashboard',
  '/admin/users': 'users', // Users page includes KYC functionality
  '/admin/packages': 'packages',
  '/admin/activations': 'packageRequests',
  '/admin/withdrawals': 'withdrawals',
  '/admin/referral-income': 'reports',
  '/admin/reports': 'reports', // All reports routes
  '/admin/payout-reports': 'payoutReports', // All payout reports routes
  '/admin/payout-reports/payout-report': 'payoutReports',
  '/admin/payout-reports/payout-history': 'payoutReports',
  '/admin/level-tree': 'levelTree',
  '/admin/content': 'content',
  '/admin/migration': 'migration',
}

// Check if user has permission for a route
export function hasPermission(userData, path) {
  // SuperAdmin and admin have all permissions
  if (userData?.role === 'superAdmin' || userData?.role === 'admin') {
    return true
  }

  // SubAdmin needs to check permissions
  if (userData?.role === 'subAdmin') {
    // Check exact path first
    let permissionKey = PERMISSION_MAP[path]
    
    // If not found, check if it's a child route
    if (!permissionKey && path.startsWith('/admin/reports')) {
      permissionKey = PERMISSION_MAP['/admin/reports']
    }
    if (!permissionKey && path.startsWith('/admin/payout-reports')) {
      permissionKey = PERMISSION_MAP['/admin/payout-reports']
    }
    
    if (!permissionKey) {
      // If no permission mapping, deny access (for security)
      return false
    }
    const permissions = userData.permissions || {}
    const groupPerms = permissions[permissionKey] || {}
    // Need at least 'view' permission
    return groupPerms.view === true
  }

  return false
}

// Check if user has specific action permission
export function hasActionPermission(userData, permissionGroup, action) {
  // SuperAdmin and admin have all permissions
  if (userData?.role === 'superAdmin' || userData?.role === 'admin') {
    return true
  }

  // SubAdmin needs to check permissions
  if (userData?.role === 'subAdmin') {
    const permissions = userData.permissions || {}
    const groupPerms = permissions[permissionGroup] || {}
    return groupPerms[action] === true
  }

  return false
}

// Get all allowed routes for a user
export function getAllowedRoutes(userData) {
  if (userData?.role === 'superAdmin' || userData?.role === 'admin') {
    return Object.keys(PERMISSION_MAP)
  }

  if (userData?.role === 'subAdmin') {
    const permissions = userData.permissions || {}
    return Object.entries(PERMISSION_MAP)
      .filter(([path, key]) => {
        const groupPerms = permissions[key] || {}
        return groupPerms.view === true
      })
      .map(([path]) => path)
  }

  return []
}

