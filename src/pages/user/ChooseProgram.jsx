import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection, useFirestore } from '../../hooks/useFirestore'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { DollarSign, CheckCircle, AlertCircle } from 'lucide-react'
import { formatCurrency } from '../../utils/helpers'

export default function ChooseProgram() {
  const { user, userData } = useAuth()
  const navigate = useNavigate()
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [processing, setProcessing] = useState(false)

  const { data: packages } = useCollection('packages', [])
  const { data: programConfig } = useFirestore(doc(db, 'adminConfig', 'programs'))
  const { data: activationConfig } = useFirestore(doc(db, 'adminConfig', 'activationRules'))

  // Redirect if user is already a Leader (auto-activated on signup)
  useEffect(() => {
    if (userData?.programType === 'leader') {
      toast.success('You are already activated as a Leader!')
      navigate('/app/dashboard', { replace: true })
    }
  }, [userData, navigate])

  const config = programConfig || {
    enableInvestorProgram: true,
    enableLeaderProgram: true,
    investorCapMultiplier: 2.0,
    leaderCapMultiplier: 3.0,
    leaderBaseAmount: 1000,
    leaderROIEnabled: false
  }

  const activationWindow = activationConfig?.activationWindowDays || 7
  const createdAt = userData?.createdAt?.toDate?.() || new Date()
  const deadline = new Date(createdAt)
  deadline.setDate(deadline.getDate() + activationWindow)
  const daysRemaining = Math.max(0, Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)))

  const handleSelectProgram = (programType) => {
    setSelectedProgram(programType)
    // Only Investor program available - need to select a plan
    setSelectedPlan(null)
  }

  const handleActivate = async () => {
    if (!selectedProgram) {
      toast.error('Please select a program')
      return
    }

    if (!selectedPlan) {
      toast.error('Please select a package')
      return
    }

    setProcessing(true)
    try {
      const userId = user?.uid || userData?.uid
      
      // Only Investor program available - redirect to packages page to select and pay
      await setDoc(doc(db, 'users', userId), {
        programType: 'investor',
        selectedPlanId: selectedPlan,
        updatedAt: serverTimestamp()
      }, { merge: true })

      navigate('/app/packages', { state: { selectedPlan } })
    } catch (error) {
      console.error('Error activating program:', error)
      toast.error(error.message || 'Error activating program')
    } finally {
      setProcessing(false)
    }
  }

  // Redirect if user is already a Leader (show loading while checking)
  if (userData?.programType === 'leader') {
    return (
      <div className="min-h-screen flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full">
          <div className="card text-center">
            <CheckCircle className="text-green-500 mx-auto mb-4" size={48} />
            <h1 className="text-2xl font-bold mb-2">Already Activated</h1>
            <p className="text-gray-400 mb-6">
              You are already activated as a Leader. Redirecting to dashboard...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Check if user has completed bank details
  if (!userData?.bankDetailsCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full">
          <div className="card text-center">
            <AlertCircle className="text-yellow-500 mx-auto mb-4" size={48} />
            <h1 className="text-2xl font-bold mb-2">Bank Details Required</h1>
            <p className="text-gray-400 mb-6">
              Please complete your bank details first to proceed.
            </p>
            <button
              onClick={() => navigate('/app/onboarding/bank-details')}
              className="btn-primary"
            >
              Complete Bank Details
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Choose Your Program</h1>
          <p className="text-gray-400">
            Select the program that suits you best
          </p>
          {daysRemaining > 0 && (
            <div className="mt-4 inline-block bg-yellow-500 bg-opacity-20 border border-yellow-500 rounded-lg px-4 py-2">
              <p className="text-yellow-500 text-sm">
                ⏰ Activate within {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} to avoid account blocking
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 mb-8 max-w-2xl mx-auto">
          {/* Investor Program */}
          {config.enableInvestorProgram && (
            <div
              className={`card cursor-pointer transition-all ${
                selectedProgram === 'investor'
                  ? 'border-2 border-primary bg-primary bg-opacity-10'
                  : 'border border-gray-700 hover:border-gray-600'
              }`}
              onClick={() => handleSelectProgram('investor')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${
                    selectedProgram === 'investor' ? 'bg-primary' : 'bg-gray-700'
                  }`}>
                    <DollarSign size={24} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Investor Program</h2>
                    <p className="text-sm text-gray-400">2× Earnings Cap</p>
                  </div>
                </div>
                {selectedProgram === 'investor' && (
                  <CheckCircle className="text-primary" size={24} />
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle size={16} className="text-green-500" />
                  <span>Paid activation required</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle size={16} className="text-green-500" />
                  <span>ROI earnings enabled</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle size={16} className="text-green-500" />
                  <span>Level income enabled</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle size={16} className="text-green-500" />
                  <span>2× cap multiplier</span>
                </div>
                <div className="pt-3 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-2">Select a package to activate:</p>
                  {selectedProgram === 'investor' && (
                    <select
                      value={selectedPlan || ''}
                      onChange={(e) => setSelectedPlan(e.target.value)}
                      className="input-field"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">Select Package</option>
                      {packages.map(pkg => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} - {formatCurrency(pkg.inrPrice || pkg.usdPrice || 0, 'INR')}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {selectedProgram && (
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-1">
                  Investor Program Selected
                </h3>
                {selectedPlan && (
                  <p className="text-gray-400 text-sm">
                    Package: {packages.find(p => p.id === selectedPlan)?.name || 'N/A'}
                  </p>
                )}
              </div>
              <button
                onClick={handleActivate}
                disabled={processing || !selectedPlan}
                className="btn-primary"
              >
                {processing ? 'Processing...' : 'Continue to Payment'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

