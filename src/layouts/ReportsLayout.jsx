import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { hasActionPermission } from '../utils/permissions'

export default function ReportsLayout() {
  const { userData } = useAuth()
  const location = useLocation()
  const [expanded, setExpanded] = useState(true)

  // Check if user has reports.view permission
  const canViewReports = userData?.role === 'superAdmin' || 
                        userData?.role === 'admin' ||
                        hasActionPermission(userData, 'reports', 'view')

  if (!canViewReports) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="card text-center">
          <p className="text-red-500 text-lg mb-2">Access Denied</p>
          <p className="text-gray-400">You don't have permission to view reports</p>
        </div>
      </div>
    )
  }

  const reportItems = [
    { path: '/admin/reports/level', label: 'Level Report' },
    { path: '/admin/reports/direct-referral', label: 'Direct Referral Report' },
    { path: '/admin/reports/roi', label: 'ROI Report' },
    { path: '/admin/reports/level-on-roi', label: 'Level on ROI Report' },
    { path: '/admin/reports/consolidated', label: 'Consolidated Payout' },
    { path: '/admin/reports/consolidated-without-direct', label: 'Consolidated Payout without Direct Referral' },
    { path: '/admin/reports/all-user-income', label: 'All User Income' },
  ]

  return (
    <div className="min-h-screen bg-dark">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-dark-light min-h-screen border-r border-gray-800 p-4">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-primary">Reports</h1>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-gray-300 hover:bg-dark-lighter transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText size={20} />
                <span className="font-semibold">Reports</span>
              </div>
              {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </button>

            {expanded && (
              <div className="ml-8 mt-2 space-y-1">
                {reportItems.map((item) => {
                  const isActive = location.pathname === item.path
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`block px-4 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-primary text-white'
                          : 'text-gray-400 hover:text-white hover:bg-dark-lighter'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            )}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

