import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
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
  Calendar
} from 'lucide-react'

export default function AdminLayout() {
  const { userData, logout } = useAuth()
  const location = useLocation()

  const navItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/branding', icon: Palette, label: 'Branding' },
    { path: '/admin/content', icon: FileText, label: 'Content' },
    { path: '/admin/services', icon: Briefcase, label: 'Services' },
    { path: '/admin/packages', icon: Package, label: 'Packages' },
    { path: '/admin/marketing-plan', icon: TrendingUp, label: 'Marketing Plan' },
    { path: '/admin/income-rules', icon: DollarSign, label: 'Income Rules' },
    { path: '/admin/bonanza', icon: Gift, label: 'Bonanza' },
    { path: '/admin/terms', icon: FileCheck, label: 'Terms' },
    { path: '/admin/contact', icon: Phone, label: 'Contact' },
    { path: '/admin/users', icon: Users, label: 'Users' },
    { path: '/admin/wallets', icon: Wallet, label: 'Wallets' },
    { path: '/admin/withdrawals', icon: ArrowUpCircle, label: 'Withdrawals' },
    { path: '/admin/transfers', icon: DollarSign, label: 'Transfers' },
    { path: '/admin/activations', icon: Users, label: 'Activations' },
    { path: '/admin/renewals', icon: RefreshCw, label: 'Renewals' },
    { path: '/admin/renewal-settings', icon: RefreshCw, label: 'Renewal Settings' },
    { path: '/admin/program-settings', icon: Target, label: 'Program Settings' },
    { path: '/admin/activation-rules', icon: Clock, label: 'Activation Rules' },
    { path: '/admin/referral-income-settings', icon: UserCog, label: 'Referral Income Settings' },
    { path: '/admin/referral-income', icon: DollarSign, label: 'Referral Income Report' },
    { path: '/admin/payout-settings', icon: Calendar, label: 'Payout Settings' },
    { path: '/admin/feature-settings', icon: Settings, label: 'Feature Settings' },
    { path: '/admin/settings', icon: Settings, label: 'Settings' },
  ]

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

