import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useMemo } from 'react'
import {
  LayoutDashboard,
  Palette,
  FileText,
  Briefcase,
  Package,
  TrendingUp,
  DollarSign,
  Gift,
  FileCheck,
  Phone,
  Users,
  Settings,
  LogOut,
  Wallet,
  ArrowUpCircle,
  RefreshCw,
  Clock,
  Target,
  UserCog,
  Calendar,
  TreePine,
  Shield,
  Building2
} from 'lucide-react'

// Permission mapping for menu items
const PERMISSION_MAP = {
  '/admin/dashboard': 'dashboard',
  '/admin/users': 'users', // Users page includes KYC functionality
  '/admin/kyc-management': 'kyc', // KYC Management page
  '/admin/bank-verification': 'kyc', // Bank Verification page
  '/admin/packages': 'packages',
  '/admin/activations': 'packageRequests',
  '/admin/withdrawals': 'withdrawals',
  '/admin/referral-income': 'reports',
  '/admin/level-tree': 'levelTree',
  '/admin/content': 'content',
}

// Check if user has permission for a route
function hasPermission(userData, path) {
  // SuperAdmin and admin have all permissions
  if (userData?.role === 'superAdmin' || userData?.role === 'admin') {
    return true
  }

  // SubAdmin needs to check permissions
  if (userData?.role === 'subAdmin') {
    const permissionKey = PERMISSION_MAP[path]
    if (!permissionKey) {
      // If no permission mapping, allow access (for settings, etc.)
      return true
    }
    const permissions = userData.permissions || {}
    const groupPerms = permissions[permissionKey] || {}
    // Need at least 'view' permission
    return groupPerms.view === true
  }

  return false
}

export default function AdminLayout() {
  const { userData, logout, isSuperAdmin } = useAuth()
  const location = useLocation()

  const allNavItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard', permission: 'dashboard' },
    { path: '/admin/branding', icon: Palette, label: 'Branding', permission: null, superAdminOnly: true },
    { path: '/admin/content', icon: FileText, label: 'Content', permission: 'content' },
    { path: '/admin/services', icon: Briefcase, label: 'Services', permission: null, superAdminOnly: true },
    { path: '/admin/packages', icon: Package, label: 'Packages', permission: 'packages' },
    { path: '/admin/marketing-plan', icon: TrendingUp, label: 'Marketing Plan', permission: null, superAdminOnly: true },
    { path: '/admin/income-rules', icon: DollarSign, label: 'Income Rules', permission: null, superAdminOnly: true },
    { path: '/admin/bonanza', icon: Gift, label: 'Bonanza', permission: null, superAdminOnly: true },
    { path: '/admin/terms', icon: FileCheck, label: 'Terms', permission: null, superAdminOnly: true },
    { path: '/admin/contact', icon: Phone, label: 'Contact', permission: null, superAdminOnly: true },
    { path: '/admin/users', icon: Users, label: 'Users', permission: 'users' },
    { path: '/admin/kyc-management', icon: FileCheck, label: 'KYC Management', permission: 'kyc' },
    { path: '/admin/bank-verification', icon: Building2, label: 'Bank Verification', permission: 'kyc' },
    { path: '/admin/level-tree', icon: TreePine, label: 'Level Tree', permission: 'levelTree' },
    { path: '/admin/wallets', icon: Wallet, label: 'Wallets', permission: null, superAdminOnly: true },
    { path: '/admin/withdrawals', icon: ArrowUpCircle, label: 'Withdrawals', permission: 'withdrawals' },
    { path: '/admin/transfers', icon: DollarSign, label: 'Transfers', permission: null, superAdminOnly: true },
    { path: '/admin/activations', icon: Users, label: 'Activations', permission: 'packageRequests' },
    { path: '/admin/renewals', icon: RefreshCw, label: 'Renewals', permission: null, superAdminOnly: true },
    { path: '/admin/renewal-settings', icon: RefreshCw, label: 'Renewal Settings', permission: null, superAdminOnly: true },
    { path: '/admin/program-settings', icon: Target, label: 'Program Settings', permission: null, superAdminOnly: true },
    { path: '/admin/activation-rules', icon: Clock, label: 'Activation Rules', permission: null, superAdminOnly: true },
    { path: '/admin/referral-income-settings', icon: UserCog, label: 'Referral Income Settings', permission: null, superAdminOnly: true },
    { path: '/admin/reports', icon: FileText, label: 'Reports', permission: 'reports', isReportsMenu: true },
    { path: '/admin/payout-reports', icon: DollarSign, label: 'Payout Reports', permission: 'payoutReports', isPayoutReportsMenu: true },
    { path: '/admin/payout-settings', icon: Calendar, label: 'Payout Settings', permission: null, superAdminOnly: true },
    { path: '/admin/feature-settings', icon: Settings, label: 'Feature Settings', permission: null, superAdminOnly: true },
    { path: '/admin/user-menu-settings', icon: Settings, label: 'User Menu Settings', permission: null, superAdminOnly: true },
    { path: '/admin/settings', icon: Settings, label: 'Settings', permission: null, superAdminOnly: true },
    { path: '/admin/sub-admins', icon: Shield, label: 'Sub Admins', permission: null, superAdminOnly: true },
  ]

  // Filter nav items based on permissions
  const navItems = useMemo(() => {
    return allNavItems.filter(item => {
      // SuperAdmin only items
      if (item.superAdminOnly && !isSuperAdmin) {
        return false
      }

      // Check permissions for sub-admins
      if (userData?.role === 'subAdmin') {
        return hasPermission(userData, item.path)
      }

      // Admin and superAdmin see all non-superAdmin-only items
      return true
    })
  }, [userData, isSuperAdmin])

  return (
    <div className="min-h-screen bg-dark">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-dark-light min-h-screen border-r border-gray-800 p-4 overflow-y-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-primary">Admin Panel</h1>
            <p className="text-sm text-gray-400">{userData?.name || 'Admin'}</p>
          </div>
          
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              // Check if current path matches or is a child of this path
              const isActive = location.pathname === item.path || 
                              (item.path === '/admin/reports' && location.pathname.startsWith('/admin/reports'))
              return (
                <Link
                  key={item.path}
                  to={item.path === '/admin/reports' ? '/admin/reports/level' : item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-300 hover:bg-dark-lighter'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="mt-8 pt-8 border-t border-gray-800">
            <Link
              to="/"
              className="block px-4 py-2 text-sm text-gray-400 hover:text-white mb-2"
            >
              View Site
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-dark-lighter w-full"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

