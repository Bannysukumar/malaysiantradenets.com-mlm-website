import { useAuth } from '../../contexts/AuthContext'
import { useFirestore, useCollection } from '../../hooks/useFirestore'
import { doc, query, where, orderBy, collection } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { Copy, Users, DollarSign, AlertCircle, History } from 'lucide-react'
import { getReferralLink, formatCurrency, formatDate } from '../../utils/helpers'
import toast from 'react-hot-toast'
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'

export default function UserReferrals() {
  const { user, userData } = useAuth()
  const { data: referralConfig } = useFirestore(doc(db, 'adminConfig', 'referralIncome'))
  const [copied, setCopied] = useState(false)

  const userId = user?.uid || userData?.uid
  const isInvestor = userData?.programType === 'investor' && userData?.status === 'ACTIVE_INVESTOR'
  const isLeader = userData?.programType === 'leader'

  // Get direct referrals
  const { data: allUsers } = useCollection('users', [])
  const directReferrals = useMemo(() => {
    if (!userId) return []
    return allUsers.filter(u => u.referredByUid === userId)
  }, [allUsers, userId])

  // Get referral income history (both direct and level income)
  // Note: Query subcollection directly - no userId field needed in entries
  const { data: incomeEntries, loading: incomeLoading } = useCollection(
    userId ? `incomeLedger/${userId}/entries` : 'incomeLedger',
    userId ? [
      where('type', 'in', ['REFERRAL_DIRECT', 'REFERRAL_LEVEL']),
      orderBy('createdAt', 'desc')
    ] : []
  )

  const referralIncomeTotal = useMemo(() => {
    if (!incomeEntries || incomeEntries.length === 0) return 0
    return incomeEntries
      .filter(e => {
        const status = e.status?.toLowerCase() || ''
        return status === 'approved' || status === 'completed'
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0)
  }, [incomeEntries])

  // Separate direct and level income
  const directIncomeEntries = useMemo(() => {
    return incomeEntries?.filter(e => e.type === 'REFERRAL_DIRECT') || []
  }, [incomeEntries])

  const levelIncomeEntries = useMemo(() => {
    return incomeEntries?.filter(e => e.type === 'REFERRAL_LEVEL') || []
  }, [incomeEntries])

  const referralLink = getReferralLink(userData?.refCode || '')
  const directPercent = referralConfig?.directReferralPercent || 5.0

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    toast.success('Referral link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const maskEmail = (email) => {
    if (!email) return 'N/A'
    const [name, domain] = email.split('@')
    if (name.length <= 2) return email
    return `${name.substring(0, 2)}***@${domain}`
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Referral Program</h1>

      {/* Leader Message */}
      {isLeader && (
        <div className="card border-yellow-500 border-2 mb-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={24} />
            <div>
              <h2 className="text-xl font-bold text-yellow-500 mb-2">Referral Income Not Available</h2>
              <p className="text-gray-300">
                Leaders cannot earn referral income. Referral income is only available for Investors.
                Your referral code can still be used for hierarchy tracking purposes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Referral Link */}
      <div className="card mb-6">
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
          Share this link with others. {isInvestor && `Earn ${directPercent}% when they activate as Investor.`}
        </p>
      </div>

      {/* Investor Referral Income Section */}
      {isInvestor && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="card">
              <h3 className="text-sm text-gray-400 mb-2">Direct Referral Commission</h3>
              <p className="text-3xl font-bold text-primary">{directPercent}%</p>
              <p className="text-sm text-gray-400 mt-1">On Investor activation</p>
            </div>

            <div className="card">
              <h3 className="text-sm text-gray-400 mb-2">Total Referral Income</h3>
              <p className="text-3xl font-bold text-green-500">{formatCurrency(referralIncomeTotal, 'INR')}</p>
              <p className="text-sm text-gray-400 mt-1">Lifetime earned</p>
            </div>

            <div className="card">
              <h3 className="text-sm text-gray-400 mb-2">Direct Referrals</h3>
              <p className="text-3xl font-bold text-white">{directReferrals.length}</p>
              <p className="text-sm text-gray-400 mt-1">Total referrals</p>
            </div>
          </div>

          {/* Direct Referrals List */}
          <div className="card mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Users className="text-primary" size={24} />
              Direct Referrals
            </h2>
            {directReferrals.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Users className="mx-auto mb-2" size={48} />
                <p>No referrals yet. Share your referral link to get started!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 font-semibold">Name</th>
                      <th className="text-left py-3 px-4 font-semibold">Email</th>
                      <th className="text-left py-3 px-4 font-semibold">Status</th>
                      <th className="text-left py-3 px-4 font-semibold">Program</th>
                      <th className="text-left py-3 px-4 font-semibold">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directReferrals.map((ref) => (
                      <tr key={ref.id} className="border-b border-gray-800 hover:bg-dark-lighter">
                        <td className="py-3 px-4">{ref.name || 'N/A'}</td>
                        <td className="py-3 px-4 text-sm">{maskEmail(ref.email)}</td>
                        <td className="py-3 px-4">
                          <span className={`badge ${
                            ref.status === 'ACTIVE_INVESTOR' ? 'bg-green-500' :
                            ref.status === 'ACTIVE_LEADER' ? 'bg-purple-500' :
                            ref.status === 'PENDING_ACTIVATION' ? 'bg-yellow-500' :
                            'bg-gray-500'
                          }`}>
                            {ref.status || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="badge">
                            {ref.programType === 'investor' ? 'Investor' :
                             ref.programType === 'leader' ? 'Leader' : 'Not Selected'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-400">
                          {ref.createdAt ? formatDate(ref.createdAt) : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Referral Income History */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <History className="text-primary" size={24} />
                Referral Income History
              </h2>
              <Link to="/app/income-history" className="text-primary hover:underline text-sm">
                View All Income →
              </Link>
            </div>
            {incomeLoading ? (
              <div className="text-center py-8 text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-2"></div>
                <p>Loading referral income...</p>
              </div>
            ) : !incomeEntries || incomeEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <DollarSign className="mx-auto mb-2" size={48} />
                <p>No referral income yet. Referrals will appear here when they activate as Investors.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 font-semibold">Date</th>
                      <th className="text-left py-3 px-4 font-semibold">Amount</th>
                      <th className="text-left py-3 px-4 font-semibold">Status</th>
                      <th className="text-left py-3 px-4 font-semibold">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeEntries?.slice(0, 10).map((entry) => (
                      <tr key={entry.id} className="border-b border-gray-800 hover:bg-dark-lighter">
                        <td className="py-3 px-4 text-sm">
                          {entry.createdAt ? formatDate(entry.createdAt) : 'N/A'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-green-500">
                          {formatCurrency(entry.amount || 0, 'INR')}
                          {entry.type === 'REFERRAL_LEVEL' && entry.metadata?.level && (
                            <span className="text-xs text-gray-400 ml-2">(Level {entry.metadata.level})</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`badge ${
                            entry.status === 'APPROVED' || entry.status === 'completed' ? 'bg-green-500' :
                            entry.status === 'PENDING' ? 'bg-yellow-500' :
                            'bg-gray-500'
                          }`}>
                            {entry.status || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-400">
                          {entry.description || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {incomeEntries?.length > 10 && (
                  <div className="text-center py-4">
                    <Link to="/app/income-history" className="text-primary hover:underline text-sm">
                      View all {incomeEntries.length} entries →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Pending Activation Message */}
      {!isInvestor && !isLeader && (
        <div className="card border-yellow-500 border-2">
          <div className="flex items-start gap-4">
            <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={24} />
            <div>
              <h2 className="text-xl font-bold text-yellow-500 mb-2">Activate to Earn Referral Income</h2>
              <p className="text-gray-300 mb-4">
                Activate as an Investor to start earning referral income when your referrals activate.
              </p>
              {!isLeader && (
                <Link to="/app/choose-program" className="btn-primary inline-block">
                  Choose Program
                </Link>
              )}
              {isLeader && (
                <div className="text-sm text-gray-400">
                  You are already activated as a Leader. Referral income is not available for Leaders.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

