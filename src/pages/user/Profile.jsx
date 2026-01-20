import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { User, Mail, Hash, Phone, Building2, CreditCard, Shield, Lock, CheckCircle, XCircle, Loader2, Copy, Check } from 'lucide-react'
import { useFirestore } from '../../hooks/useFirestore'
import { validateIFSC, validateAccountNumber, validateUPI } from '../../utils/validation'
import { fetchIFSCDetails } from '../../utils/ifscApi'

export default function UserProfile() {
  const { user, userData } = useAuth()
  const [activeTab, setActiveTab] = useState('personal')
  const [fetchingIFSC, setFetchingIFSC] = useState(false)
  const [copiedUserId, setCopiedUserId] = useState(false)
  const [bankDetails, setBankDetails] = useState({
    bankName: '',
    branch: '',
    city: ''
  })
  
  const copyUserId = () => {
    if (userData?.userId) {
      navigator.clipboard.writeText(userData.userId)
      setCopiedUserId(true)
      toast.success('User ID copied to clipboard!')
      setTimeout(() => setCopiedUserId(false), 2000)
    }
  }

  const userId = user?.uid
  const financialProfileRef = userId ? doc(db, 'userFinancialProfiles', userId) : null
  const { data: financialProfile, loading: profileLoading } = useFirestore(financialProfileRef)

  const personalForm = useForm({
    defaultValues: {
      name: userData?.name || '',
      phone: userData?.phone || '',
    },
  })

  const bankForm = useForm({
    defaultValues: {
      holderName: financialProfile?.bank?.holderName || '',
      accountNumber: '',
      confirmAccountNumber: '',
      ifsc: financialProfile?.bank?.ifsc || '',
      accountType: financialProfile?.bank?.accountType || 'savings',
      bankName: financialProfile?.bank?.bankName || '',
      branch: financialProfile?.bank?.branch || '',
    },
  })

  const upiForm = useForm({
    defaultValues: {
      upiId: financialProfile?.upi?.upiId || '',
    },
  })
  
  // Update bankDetails state when financialProfile loads
  useEffect(() => {
    if (financialProfile?.bank) {
      setBankDetails({
        bankName: financialProfile.bank.bankName || '',
        branch: financialProfile.bank.branch || '',
        city: financialProfile.bank.city || ''
      })
    }
  }, [financialProfile])

  const passwordForm = useForm()

  const handleFetchIFSC = async () => {
    const ifsc = bankForm.getValues('ifsc')
    const ifscError = validateIFSC(ifsc)
    
    if (ifscError) {
      toast.error(ifscError)
      return
    }

    setFetchingIFSC(true)
    try {
      const details = await fetchIFSCDetails(ifsc)
      
      if (details.valid) {
        setBankDetails({
          bankName: details.bank,
          branch: details.branch,
          city: details.city || ''
        })
        bankForm.setValue('bankName', details.bank)
        bankForm.setValue('branch', details.branch)
        bankForm.setValue('city', details.city || '')
        toast.success('Bank details fetched successfully')
      } else {
        toast.error(details.error || 'Failed to fetch bank details')
        setBankDetails({
          bankName: '',
          branch: '',
          city: ''
        })
      }
    } catch (error) {
      console.error('IFSC fetch error:', error)
      toast.error('Error fetching bank details')
    } finally {
      setFetchingIFSC(false)
    }
  }

  const onPersonalSubmit = async (data) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: data.name,
        phone: data.phone.replace(/[\s\-\(\)]/g, ''),
        updatedAt: new Date(),
      })
      toast.success('Personal details updated successfully')
    } catch (error) {
      console.error('Profile update error:', error)
      toast.error('Error updating profile')
    }
  }

  const onBankSubmit = async (data) => {
    try {
      const accountError = validateAccountNumber(data.accountNumber, data.confirmAccountNumber)
      if (accountError) {
        toast.error(accountError)
        return
      }

      const ifscError = validateIFSC(data.ifsc)
      if (ifscError) {
        toast.error(ifscError)
        return
      }

      // Mask account number (show only last 4 digits)
      const maskedAccount = `XXXXXX${data.accountNumber.slice(-4)}`
      
      const bankData = {
        bank: {
          holderName: data.holderName,
          accountNumberMasked: maskedAccount,
          accountNumberLast4: data.accountNumber.slice(-4),
          ifsc: data.ifsc.toUpperCase(),
          bankName: bankDetails.bankName || data.bankName || '',
          branch: bankDetails.branch || data.branch || '',
          city: bankDetails.city || data.city || '',
          accountType: data.accountType,
          isVerified: false, // Requires admin approval
        },
        updatedAt: new Date(),
      }

      await setDoc(doc(db, 'userFinancialProfiles', user.uid), bankData, { merge: true })
      
      // Update bankDetailsCompleted flag if not already set
      if (!userData?.bankDetailsCompleted) {
        await updateDoc(doc(db, 'users', user.uid), {
          bankDetailsCompleted: true
        })
      }
      
      toast.success('Bank details saved. Awaiting admin verification.')
      bankForm.reset()
    } catch (error) {
      console.error('Bank details update error:', error)
      toast.error('Error saving bank details')
    }
  }

  const onUPISubmit = async (data) => {
    try {
      const upiError = validateUPI(data.upiId)
      if (upiError) {
        toast.error(upiError)
        return
      }

      const upiData = {
        upi: {
          upiId: data.upiId.toLowerCase(),
          isVerified: false, // Optional verification
        },
        updatedAt: new Date(),
      }

      await setDoc(doc(db, 'userFinancialProfiles', user.uid), upiData, { merge: true })
      toast.success('UPI details saved successfully')
    } catch (error) {
      console.error('UPI update error:', error)
      toast.error('Error saving UPI details')
    }
  }

  const onChangePassword = async (data) => {
    try {
      // Password change should be handled via Firebase Auth
      const { updatePassword } = await import('firebase/auth')
      const { auth } = await import('../../config/firebase')
      
      if (data.newPassword !== data.confirmNewPassword) {
        toast.error('Passwords do not match')
        return
      }

      await updatePassword(user, data.newPassword)
      toast.success('Password changed successfully')
      passwordForm.reset()
    } catch (error) {
      console.error('Password change error:', error)
      toast.error(error.message || 'Error changing password')
    }
  }

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Profile</h1>

      <div className="mb-6">
        <div className="flex gap-2 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('personal')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'personal'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Personal Details
          </button>
          <button
            onClick={() => setActiveTab('bank')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'bank'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Bank Details
          </button>
          <button
            onClick={() => setActiveTab('upi')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'upi'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            UPI Details
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'security'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Security
          </button>
        </div>
      </div>

      {activeTab === 'personal' && (
        <div className="card max-w-2xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <User size={24} />
            Personal Information
          </h2>
          <form onSubmit={personalForm.handleSubmit(onPersonalSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <User size={16} />
                Full Name
              </label>
              <input
                type="text"
                {...personalForm.register('name', { required: 'Name is required' })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Mail size={16} />
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="input-field bg-dark-lighter opacity-50 cursor-not-allowed"
              />
              <p className="text-sm text-gray-400 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Hash size={16} />
                User ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={userData?.userId || 'Generating...'}
                  disabled
                  className="input-field bg-dark-lighter opacity-50 cursor-not-allowed pr-10"
                />
                {userData?.userId && (
                  <button
                    type="button"
                    onClick={copyUserId}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                    title="Copy User ID"
                  >
                    {copiedUserId ? (
                      <Check size={18} className="text-green-500" />
                    ) : (
                      <Copy size={18} />
                    )}
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Your unique User ID. Use this to login instead of email.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Phone size={16} />
                Mobile Number
              </label>
              <input
                type="tel"
                {...personalForm.register('phone')}
                className="input-field"
                placeholder="10 digit mobile number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Hash size={16} />
                Referral Code
              </label>
              <input
                type="text"
                value={userData?.refCode || ''}
                disabled
                className="input-field bg-dark-lighter opacity-50 cursor-not-allowed"
              />
              <p className="text-sm text-gray-400 mt-1">Your unique referral code</p>
            </div>

            <button type="submit" className="btn-primary">
              Update Personal Details
            </button>
          </form>
        </div>
      )}

      {activeTab === 'bank' && (
        <div className="card max-w-2xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Building2 size={24} />
            Bank Account Details
          </h2>
          
          {/* Display existing bank details */}
          {financialProfile?.bank?.holderName && (
            <div className="mb-6 p-4 bg-dark-lighter rounded-lg border border-gray-700">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <CreditCard className="text-primary" size={20} />
                Current Bank Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Account Holder:</span>
                  <span className="text-white font-medium">{financialProfile.bank.holderName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Account Number:</span>
                  <span className="text-white font-mono">{financialProfile.bank.accountNumberMasked || `XXXXXX${financialProfile.bank.accountNumberLast4 || 'XXXX'}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">IFSC Code:</span>
                  <span className="text-white font-mono">{financialProfile.bank.ifsc}</span>
                </div>
                {financialProfile.bank.bankName && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Bank:</span>
                    <span className="text-white">{financialProfile.bank.bankName}</span>
                  </div>
                )}
                {financialProfile.bank.branch && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Branch:</span>
                    <span className="text-white">{financialProfile.bank.branch}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Account Type:</span>
                  <span className="text-white capitalize">{financialProfile.bank.accountType || 'Savings'}</span>
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-700">
                  <span className="text-gray-400">Verification Status:</span>
                  {financialProfile.bank.isVerified ? (
                    <span className="flex items-center gap-1 text-green-500">
                      <CheckCircle size={16} />
                      Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-yellow-500">
                      <XCircle size={16} />
                      Pending Verification
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {financialProfile?.bank?.isVerified && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500 rounded-lg flex items-center gap-2">
              <CheckCircle className="text-green-500" size={20} />
              <span className="text-green-500 text-sm">Bank details verified by admin</span>
            </div>
          )}

          {financialProfile?.bank && !financialProfile?.bank?.isVerified && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500 rounded-lg flex items-center gap-2">
              <XCircle className="text-yellow-500" size={20} />
              <span className="text-yellow-500 text-sm">Bank details pending admin verification</span>
            </div>
          )}
          
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">
              {financialProfile?.bank?.holderName ? 'Update Bank Details' : 'Add Bank Details'}
            </h3>
            <p className="text-sm text-gray-400">
              {financialProfile?.bank?.holderName 
                ? 'Update your bank account information below. Changes will require admin verification.'
                : 'Add your bank account details to enable withdrawals.'}
            </p>
          </div>

          <form onSubmit={bankForm.handleSubmit(onBankSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Account Holder Name</label>
              <input
                type="text"
                {...bankForm.register('holderName', { required: 'Account holder name is required' })}
                className="input-field"
                placeholder="Enter account holder name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Account Number</label>
              <input
                type="text"
                {...bankForm.register('accountNumber', { required: 'Account number is required' })}
                className="input-field"
                placeholder="Enter account number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Confirm Account Number</label>
              <input
                type="text"
                {...bankForm.register('confirmAccountNumber', { required: 'Please confirm account number' })}
                className="input-field"
                placeholder="Re-enter account number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">IFSC Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  {...bankForm.register('ifsc', { required: 'IFSC code is required' })}
                  className="input-field flex-1 uppercase"
                  placeholder="SBIN0001234"
                  maxLength={11}
                />
                <button
                  type="button"
                  onClick={handleFetchIFSC}
                  disabled={fetchingIFSC}
                  className="btn-secondary px-4"
                >
                  {fetchingIFSC ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    'Fetch Details'
                  )}
                </button>
              </div>
              {bankDetails.bankName && (
                <div className="mt-2 p-3 bg-dark-lighter rounded-lg">
                  <p className="text-sm text-gray-300">Bank: {bankDetails.bankName}</p>
                  <p className="text-sm text-gray-300">Branch: {bankDetails.branch}</p>
                  {bankDetails.city && (
                    <p className="text-sm text-gray-300">City: {bankDetails.city}</p>
                  )}
                </div>
              )}
            </div>

            {!bankDetails.bankName && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Bank Name</label>
                  <input
                    type="text"
                    {...bankForm.register('bankName')}
                    className="input-field"
                    placeholder="Enter bank name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Branch</label>
                  <input
                    type="text"
                    {...bankForm.register('branch')}
                    className="input-field"
                    placeholder="Enter branch name"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">Account Type</label>
              <select
                {...bankForm.register('accountType')}
                className="input-field"
              >
                <option value="savings">Savings</option>
                <option value="current">Current</option>
              </select>
            </div>

            <div className="p-4 bg-yellow-500/10 border border-yellow-500 rounded-lg">
              <p className="text-sm text-yellow-500">
                ⚠️ Bank details will be verified by admin before you can withdraw funds.
              </p>
            </div>

            <button type="submit" className="btn-primary">
              Save Bank Details
            </button>
          </form>
        </div>
      )}

      {activeTab === 'upi' && (
        <div className="card max-w-2xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <CreditCard size={24} />
            UPI Details
          </h2>

          <form onSubmit={upiForm.handleSubmit(onUPISubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">UPI ID</label>
              <input
                type="text"
                {...upiForm.register('upiId', { required: 'UPI ID is required' })}
                className="input-field"
                placeholder="name@bank"
              />
              <p className="text-sm text-gray-400 mt-1">Example: yourname@paytm</p>
            </div>

            <button type="submit" className="btn-primary">
              Save UPI Details
            </button>
          </form>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="card max-w-2xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Lock size={24} />
            Security Settings
          </h2>

          <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Current Password</label>
              <input
                type="password"
                {...passwordForm.register('currentPassword', { required: 'Current password is required' })}
                className="input-field"
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">New Password</label>
              <input
                type="password"
                {...passwordForm.register('newPassword', { 
                  required: 'New password is required',
                  minLength: { value: 8, message: 'Password must be at least 8 characters' }
                })}
                className="input-field"
                placeholder="Enter new password"
              />
              <p className="text-gray-400 text-xs mt-1">
                Must be at least 8 characters with 1 uppercase and 1 number
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Confirm New Password</label>
              <input
                type="password"
                {...passwordForm.register('confirmNewPassword', { required: 'Please confirm new password' })}
                className="input-field"
                placeholder="Re-enter new password"
              />
            </div>

            <button type="submit" className="btn-primary">
              Change Password
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
