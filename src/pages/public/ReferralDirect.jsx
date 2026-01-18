import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { Users, Percent } from 'lucide-react'

export default function ReferralDirect() {
  const { data: marketingConfig, loading } = useFirestore(doc(db, 'marketingConfig', 'main'))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const directPercent = marketingConfig?.directReferralPercent || 5

  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-primary/20 rounded-full">
              <Users className="text-primary" size={48} />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Direct Referral</h1>
          <div className="flex items-center justify-center gap-2 text-3xl font-bold text-primary">
            <Percent size={32} />
            <span>{directPercent}%</span>
          </div>
          <p className="text-xl text-gray-300 mt-4">for any plan</p>
        </div>

        <div className="card">
          <h2 className="text-2xl font-bold mb-4">How It Works</h2>
          <div className="space-y-4 text-gray-300">
            <p>
              When you refer someone to Malaysian Trade Net, you earn <strong className="text-primary">{directPercent}%</strong> commission on any package they purchase.
            </p>
            <p>
              This direct referral bonus is paid instantly and applies to all our investment packages, from Bronze to Double Crown.
            </p>
            <p>
              The more people you refer, the more you earn. There's no limit to the number of direct referrals you can have.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

