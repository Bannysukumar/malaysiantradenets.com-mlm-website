import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { ChevronDown, ChevronRight, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useFirestore } from '../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../config/firebase'

export default function MyTeamLayout() {
  const { userData } = useAuth()
  const location = useLocation()
  const [expanded, setExpanded] = useState(true)
  const { data: featureConfig } = useFirestore(doc(db, 'adminConfig', 'features'))
  const { data: menuConfig } = useFirestore(doc(db, 'adminConfig', 'userMenuItems'))
  
  const config = featureConfig || {}
  const menuSettings = menuConfig || {}

  // Check if My Team is enabled
  const isMyTeamEnabled = config.myTeamEnabled !== false
  const isMyDirectEnabled = config.myTeam?.myDirectEnabled !== false && menuSettings.myDirect !== false
  const isLevelReportEnabled = config.myTeam?.levelReportEnabled !== false && menuSettings.levelReport !== false

  if (!isMyTeamEnabled) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="card text-center">
          <p className="text-red-500 text-lg mb-2">Feature Disabled</p>
          <p className="text-gray-400">My Team feature is currently disabled</p>
        </div>
      </div>
    )
  }

  const teamItems = [
    { path: '/app/my-team/my-direct', label: 'My Direct', enabled: isMyDirectEnabled },
    { path: '/app/my-team/level-report', label: 'Level Report', enabled: isLevelReportEnabled },
  ].filter(item => item.enabled)

  return (
    <div className="min-h-screen bg-dark">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-dark-light min-h-screen border-r border-gray-800 p-4">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-primary">My Team</h1>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-gray-300 hover:bg-dark-lighter transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users size={20} />
                <span className="font-semibold">My Team</span>
              </div>
              {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </button>

            {expanded && (
              <div className="ml-8 mt-2 space-y-1">
                {teamItems.map((item) => {
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

