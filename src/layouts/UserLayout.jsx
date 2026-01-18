import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
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
  ArrowUpCircle
} from 'lucide-react'

export default function UserLayout() {
  const { userData, logout } = useAuth()
  const location = useLocation()

  const navItems = [
    { path: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/app/packages', icon: Package, label: 'Packages' },
    { path: '/app/referrals', icon: Users, label: 'Referrals' },
    { path: '/app/wallet', icon: Wallet, label: 'Wallet' },
    { path: '/app/income-history', icon: DollarSign, label: 'Income History' },
    { path: '/app/withdraw', icon: ArrowUpCircle, label: 'Withdraw' },
    { path: '/app/profile', icon: User, label: 'Profile' },
    { path: '/app/notifications', icon: Bell, label: 'Notifications' },
    { path: '/app/support', icon: HelpCircle, label: 'Support' },
  ]

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

