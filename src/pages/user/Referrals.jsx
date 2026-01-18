import { useAuth } from '../../contexts/AuthContext'
import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { Copy, Users, DollarSign, TrendingUp } from 'lucide-react'
import { getReferralLink } from '../../utils/helpers'
import toast from 'react-hot-toast'
import { useState } from 'react'

export default function UserReferrals() {
  const { userData } = useAuth()
  const { data: marketingConfig } = useFirestore(doc(db, 'marketingConfig', 'main'))
  const [copied, setCopied] = useState(false)

  const referralLink = getReferralLink(userData?.refCode || '')
  const directPercent = marketingConfig?.directReferralPercent || 5

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    toast.success('Referral link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Referral Program</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Users className="text-primary" size={24} />
            Your Referral Link
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="input-field flex-1"
            />
            <button
              onClick={copyToClipboard}
              className="btn-primary px-4"
            >
              <Copy size={20} />
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            Share this link to earn {directPercent}% on every package purchase
          </p>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <DollarSign className="text-primary" size={24} />
            Direct Referral Commission
          </h2>
          <div className="text-center py-4">
            <p className="text-4xl font-bold text-primary mb-2">{directPercent}%</p>
            <p className="text-gray-400">On any plan your referrals purchase</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="text-primary" size={24} />
          Level Income System
        </h2>
        <p className="text-gray-300 mb-4">
          Earn additional income from multiple levels. Total Level Income on ROI = 100%
        </p>
        <a
          href="/roi-levels"
          className="text-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          View Level Income Details →
        </a>
      </div>
    </div>
  )
}

