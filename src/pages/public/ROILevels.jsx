import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { TrendingUp } from 'lucide-react'

export default function ROILevels() {
  const { data: marketingConfig, loading } = useFirestore(doc(db, 'marketingConfig', 'main'))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const defaultLevels = [
    { levelFrom: 1, levelTo: 5, percent: 5 },
    { levelFrom: 6, levelTo: 10, percent: 4 },
    { levelFrom: 11, levelTo: 15, percent: 3 },
    { levelFrom: 16, levelTo: 20, percent: 2 },
    { levelFrom: 21, levelTo: 25, percent: 1 },
  ]

  const levels = marketingConfig?.levelPercentages || defaultLevels
  const qualificationRules = marketingConfig?.qualificationRules || ''

  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-primary/20 rounded-full">
              <TrendingUp className="text-primary" size={48} />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Level Income System</h1>
          <p className="text-xl text-gray-300">Total Level Income on ROI = 100%</p>
        </div>

        <div className="card mb-8 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-4 px-4 font-semibold">Level Range</th>
                <th className="text-left py-4 px-4 font-semibold">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((level, idx) => (
                <tr key={idx} className="border-b border-gray-800 hover:bg-dark-lighter">
                  <td className="py-4 px-4 text-gray-300">
                    Level {level.levelFrom} - {level.levelTo}
                  </td>
                  <td className="py-4 px-4 text-primary font-semibold">
                    {level.percent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {qualificationRules && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-4">Qualification Rules</h2>
            <div className="text-gray-300 whitespace-pre-line">
              {qualificationRules}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

