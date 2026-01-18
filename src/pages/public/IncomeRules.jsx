import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { Shield, AlertTriangle } from 'lucide-react'

export default function IncomeRules() {
  const { data: incomeRules, loading } = useFirestore(doc(db, 'incomeRules', 'main'))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const defaultRules = {
    withSecurity: {
      minPackageInr: 50000,
      dailyPercent: 2,
      maxWorkingDays: 60,
      note: 'After 60 working days, you will receive 120% return and land return.',
    },
    withoutSecurity: {
      dailyPercent: 1.5,
      maxWorkingDays: 60,
    },
  }

  const rules = incomeRules || defaultRules

  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-12 text-center">Income Rules</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* With Security */}
          <div className="card border-2 border-primary">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="text-primary" size={32} />
              <h2 className="text-2xl font-bold">With Security</h2>
            </div>
            <div className="space-y-4">
              {rules.withSecurity?.minPackageInr && (
                <div>
                  <p className="text-gray-400 text-sm">Minimum Package</p>
                  <p className="text-white font-semibold text-lg">
                    ₹{rules.withSecurity.minPackageInr.toLocaleString()}
                  </p>
                </div>
              )}
              <div>
                <p className="text-gray-400 text-sm">Daily Income</p>
                <p className="text-white font-semibold text-lg">
                  {rules.withSecurity?.dailyPercent || 2}% per day
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Maximum Working Days</p>
                <p className="text-white font-semibold text-lg">
                  {rules.withSecurity?.maxWorkingDays || 60} days
                </p>
              </div>
              {rules.withSecurity?.note && (
                <div className="mt-4 p-4 bg-primary/10 rounded-lg">
                  <p className="text-gray-300 text-sm">{rules.withSecurity.note}</p>
                </div>
              )}
            </div>
          </div>

          {/* Without Security */}
          <div className="card border-2 border-gray-700">
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle className="text-yellow-500" size={32} />
              <h2 className="text-2xl font-bold">Without Security</h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-gray-400 text-sm">Daily Income</p>
                <p className="text-white font-semibold text-lg">
                  {rules.withoutSecurity?.dailyPercent || 1.5}% per day
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Maximum Working Days</p>
                <p className="text-white font-semibold text-lg">
                  {rules.withoutSecurity?.maxWorkingDays || 60} days
                </p>
              </div>
              {rules.withoutSecurity?.note && (
                <div className="mt-4 p-4 bg-yellow-500/10 rounded-lg">
                  <p className="text-gray-300 text-sm">{rules.withoutSecurity.note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

