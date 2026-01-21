import { useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { hasActionPermission } from '../../../utils/permissions'
import { Database, Upload, Wallet, ArrowUpCircle, FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import ImportUsers from './ImportUsers'
import ImportIncomes from './ImportIncomes'
import ImportWallets from './ImportWallets'
import ImportPayouts from './ImportPayouts'
import ValidationReports from './ValidationReports'

export default function Migration() {
  const { isSuperAdmin, userData } = useAuth()
  const [activeTab, setActiveTab] = useState('users')

  // Check if user has migration permission
  const hasMigrationAccess = isSuperAdmin || hasActionPermission(userData, 'migration', 'view')

  if (!hasMigrationAccess) {
    return (
      <div className="bg-dark p-8 rounded-lg">
        <div className="flex items-center gap-3 text-red-500">
          <AlertCircle size={24} />
          <h2 className="text-2xl font-bold">Access Denied</h2>
        </div>
        <p className="text-gray-400 mt-4">You don't have permission to access the Migration module. Please contact a Super Admin to grant you access.</p>
      </div>
    )
  }

  const tabs = [
    { id: 'users', label: 'Import Users', icon: Database },
    { id: 'incomes', label: 'Import Incomes', icon: Upload },
    { id: 'wallets', label: 'Wallet Adjustments', icon: Wallet },
    { id: 'payouts', label: 'Import Payouts', icon: ArrowUpCircle },
    { id: 'validation', label: 'Validation Reports', icon: FileText },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Data Migration</h1>
        <p className="text-gray-400">Import old-site data into the new Firebase app without disturbing existing users/data</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                <Icon size={20} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'users' && <ImportUsers />}
        {activeTab === 'incomes' && <ImportIncomes />}
        {activeTab === 'wallets' && <ImportWallets />}
        {activeTab === 'payouts' && <ImportPayouts />}
        {activeTab === 'validation' && <ValidationReports />}
      </div>
    </div>
  )
}

