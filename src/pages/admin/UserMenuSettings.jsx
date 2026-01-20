import { useState, useEffect, useRef } from 'react'
import { useFirestore } from '../../hooks/useFirestore'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  User, 
  Bell, 
  HelpCircle,
  Wallet,
  DollarSign,
  ArrowUpCircle,
  Send,
  History,
  UserPlus,
  RefreshCw,
  TreePine,
  Save
} from 'lucide-react'

// Define all available menu items with their metadata
const MENU_ITEMS = [
  { 
    key: 'dashboard', 
    path: '/app/dashboard', 
    label: 'Dashboard', 
    icon: LayoutDashboard,
    defaultEnabled: true 
  },
  { 
    key: 'packages', 
    path: '/app/packages', 
    label: 'Packages', 
    icon: Package,
    defaultEnabled: true 
  },
  { 
    key: 'referrals', 
    path: '/app/referrals', 
    label: 'Referrals', 
    icon: Users,
    defaultEnabled: true 
  },
  { 
    key: 'levelTree', 
    path: '/app/level-tree', 
    label: 'Level Tree', 
    icon: TreePine,
    defaultEnabled: true 
  },
  { 
    key: 'wallet', 
    path: '/app/wallet', 
    label: 'Wallet', 
    icon: Wallet,
    defaultEnabled: true 
  },
  { 
    key: 'incomeHistory', 
    path: '/app/income-history', 
    label: 'Income History', 
    icon: DollarSign,
    defaultEnabled: true 
  },
  { 
    key: 'withdraw', 
    path: '/app/withdraw', 
    label: 'Withdraw', 
    icon: ArrowUpCircle,
    defaultEnabled: true 
  },
  { 
    key: 'transfer', 
    path: '/app/transfer', 
    label: 'Transfer', 
    icon: Send,
    defaultEnabled: false 
  },
  { 
    key: 'transferHistory', 
    path: '/app/transfer-history', 
    label: 'Transfer History', 
    icon: History,
    defaultEnabled: false 
  },
  { 
    key: 'activateUser', 
    path: '/app/activate-user', 
    label: 'Activate User', 
    icon: UserPlus,
    defaultEnabled: false 
  },
  { 
    key: 'activationHistory', 
    path: '/app/activation-history', 
    label: 'Activation History', 
    icon: History,
    defaultEnabled: false 
  },
  { 
    key: 'renewal', 
    path: '/app/renewal', 
    label: 'Renew ID', 
    icon: RefreshCw,
    defaultEnabled: true 
  },
  { 
    key: 'profile', 
    path: '/app/profile', 
    label: 'Profile', 
    icon: User,
    defaultEnabled: true 
  },
  { 
    key: 'notifications', 
    path: '/app/notifications', 
    label: 'Notifications', 
    icon: Bell,
    defaultEnabled: true 
  },
  { 
    key: 'support', 
    path: '/app/support', 
    label: 'Support', 
    icon: HelpCircle,
    defaultEnabled: true 
  },
]

export default function UserMenuSettings() {
  const menuConfigRef = doc(db, 'adminConfig', 'userMenuItems')
  const { data: menuConfig, loading } = useFirestore(menuConfigRef)
  const hasInitialized = useRef(false)
  
  // Initialize state with defaults first
  const getDefaultState = () => {
    const defaultState = {}
    MENU_ITEMS.forEach(item => {
      defaultState[item.key] = item.defaultEnabled
    })
    return defaultState
  }

  const [menuState, setMenuState] = useState(getDefaultState)
  const [saving, setSaving] = useState(false)

  // Update state when config loads (only once on initial load)
  useEffect(() => {
    if (menuConfig && !hasInitialized.current) {
      const newState = {}
      MENU_ITEMS.forEach(item => {
        newState[item.key] = menuConfig[item.key] !== undefined 
          ? menuConfig[item.key] 
          : item.defaultEnabled
      })
      setMenuState(newState)
      hasInitialized.current = true
    } else if (!menuConfig && !hasInitialized.current && !loading) {
      // If no config exists and loading is done, use defaults
      hasInitialized.current = true
    }
  }, [menuConfig, loading])

  const handleToggle = (key) => {
    setMenuState(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await setDoc(menuConfigRef, {
        ...menuState,
        updatedAt: new Date()
      }, { merge: true })
      toast.success('User menu settings saved successfully')
    } catch (error) {
      console.error('Error saving menu settings:', error)
      toast.error('Failed to save menu settings')
    } finally {
      setSaving(false)
    }
  }

  const handleEnableAll = () => {
    const allEnabled = {}
    MENU_ITEMS.forEach(item => {
      allEnabled[item.key] = true
    })
    setMenuState(allEnabled)
  }

  const handleDisableAll = () => {
    const allDisabled = {}
    MENU_ITEMS.forEach(item => {
      allDisabled[item.key] = false
    })
    setMenuState(allDisabled)
  }

  const handleReset = () => {
    const defaultState = {}
    MENU_ITEMS.forEach(item => {
      defaultState[item.key] = item.defaultEnabled
    })
    setMenuState(defaultState)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">User Menu Settings</h1>
        <div className="flex gap-3">
          <button
            onClick={handleEnableAll}
            className="btn-secondary"
          >
            Enable All
          </button>
          <button
            onClick={handleDisableAll}
            className="btn-secondary"
          >
            Disable All
          </button>
          <button
            onClick={handleReset}
            className="btn-secondary"
          >
            Reset to Default
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="mb-4">
          <p className="text-gray-400">
            Enable or disable menu items that appear in the user dashboard sidebar. 
            Disabled items will be hidden from users.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon
            const isEnabled = menuState[item.key] !== false
            
            return (
              <div
                key={item.key}
                className={`border rounded-lg p-4 transition-all ${
                  isEnabled
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-gray-700 bg-dark-lighter'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Icon 
                      size={24} 
                      className={isEnabled ? 'text-green-500' : 'text-gray-500'} 
                    />
                    <div>
                      <h3 className="font-semibold">{item.label}</h3>
                      <p className="text-xs text-gray-400">{item.path}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isEnabled ? 'text-green-500' : 'text-gray-500'}`}>
                    {isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleToggle(item.key)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

