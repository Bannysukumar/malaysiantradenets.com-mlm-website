import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFirestore } from '../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  User, 
  Bell, 
  HelpCircle,
  LogOut,
  Wallet,
  DollarSign,
  ArrowUpCircle,
  Send,
  History,
  UserPlus,
  RefreshCw,
  TreePine,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { useState } from 'react'

export default function UserLayout() {
  const { userData, logout } = useAuth()
  const location = useLocation()
  const [expandedMyTeam, setExpandedMyTeam] = useState(true)
  const { data: featureConfig } = useFirestore(doc(db, 'adminConfig', 'features'))
  const { data: menuConfig } = useFirestore(doc(db, 'adminConfig', 'userMenuItems'))
  const config = featureConfig || {}
  const menuSettings = menuConfig || {}
  
  // Check My Team feature
  const isMyTeamEnabled = config.myTeamEnabled !== false
  const isMyDirectEnabled = config.myTeam?.myDirectEnabled !== false && menuSettings.myDirect !== false
  const isLevelReportEnabled = config.myTeam?.levelReportEnabled !== false && menuSettings.levelReport !== false

  const allNavItems = [
    { path: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard', key: 'dashboard' },
    { path: '/app/packages', icon: Package, label: 'Packages', key: 'packages' },
    { path: '/app/referrals', icon: Users, label: 'Referrals', key: 'referrals' },
    { path: '/app/level-tree', icon: TreePine, label: 'Level Tree', key: 'levelTree' },
    { path: '/app/wallet', icon: Wallet, label: 'Wallet', key: 'wallet' },
    { path: '/app/income-history', icon: DollarSign, label: 'Income History', key: 'incomeHistory' },
    { path: '/app/withdraw', icon: ArrowUpCircle, label: 'Withdraw', key: 'withdraw' },
    { path: '/app/transfer', icon: Send, label: 'Transfer', requiresFeature: 'enableUserTransfers', key: 'transfer' },
    { path: '/app/transfer-history', icon: History, label: 'Transfer History', requiresFeature: 'enableUserTransfers', key: 'transferHistory' },
    { path: '/app/activate-user', icon: UserPlus, label: 'Activate User', requiresFeature: 'enableSponsorActivation', key: 'activateUser' },
    { path: '/app/activation-history', icon: History, label: 'Activation History', requiresFeature: 'enableSponsorActivation', key: 'activationHistory' },
    { path: '/app/renewal', icon: RefreshCw, label: 'Renew ID', key: 'renewal' },
    { path: '/app/profile', icon: User, label: 'Profile', key: 'profile' },
    { path: '/app/notifications', icon: Bell, label: 'Notifications', key: 'notifications' },
    { path: '/app/support', icon: HelpCircle, label: 'Support', key: 'support' },
  ]

  // Filter nav items based on menu settings and feature toggles
  const navItems = allNavItems.filter(item => {
    // Check if menu item is enabled in admin settings
    // Default to true if not configured (backward compatibility)
    const isMenuEnabled = menuSettings[item.key] !== false
    
    // Check feature toggles for items that require them
    const featureCheck = !item.requiresFeature || config[item.requiresFeature] === true
    
    return isMenuEnabled && featureCheck
  })

  return (
    <div className="min-h-screen bg-dark">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-dark-light min-h-screen border-r border-gray-800 p-4">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-primary">MTN</h1>
            <p className="text-sm text-gray-400">Member Portal</p>
          </div>
          
          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
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

            {/* My Team Dropdown */}
            {isMyTeamEnabled && (isMyDirectEnabled || isLevelReportEnabled) && (
              <div>
                <button
                  onClick={() => setExpandedMyTeam(!expandedMyTeam)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                    location.pathname.startsWith('/app/my-team')
                      ? 'bg-primary text-white'
                      : 'text-gray-300 hover:bg-dark-lighter'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users size={20} />
                    <span>My Team</span>
                  </div>
                  {expandedMyTeam ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </button>

                {expandedMyTeam && (
                  <div className="ml-8 mt-2 space-y-1">
                    {isMyDirectEnabled && (
                      <Link
                        to="/app/my-team/my-direct"
                        className={`block px-4 py-2 rounded-lg transition-colors ${
                          location.pathname === '/app/my-team/my-direct'
                            ? 'bg-primary text-white'
                            : 'text-gray-400 hover:text-white hover:bg-dark-lighter'
                        }`}
                      >
                        My Direct
                      </Link>
                    )}
                    {isLevelReportEnabled && (
                      <Link
                        to="/app/my-team/level-report"
                        className={`block px-4 py-2 rounded-lg transition-colors ${
                          location.pathname === '/app/my-team/level-report'
                            ? 'bg-primary text-white'
                            : 'text-gray-400 hover:text-white hover:bg-dark-lighter'
                        }`}
                      >
                        Level Report
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </nav>

          <div className="mt-8 pt-8 border-t border-gray-800">
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
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

