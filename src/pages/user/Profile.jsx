import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import { doc, setDoc, updateDoc, collection, query, where, getDocs, deleteDoc, addDoc } from 'firebase/firestore'
import { db, storage } from '../../config/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import toast from 'react-hot-toast'
import { 
  User, Mail, Hash, Phone, Building2, CreditCard, Shield, Lock, CheckCircle, XCircle, 
  Loader2, Copy, Check, Share2, Calendar, MapPin, FileText, Upload, Camera, 
  Trash2, Edit, Eye, EyeOff, Wallet, FileCheck, Image as ImageIcon, AlertCircle
} from 'lucide-react'
import { useFirestore, useCollection } from '../../hooks/useFirestore'
import { validateIFSC, validateAccountNumber, validateUPI } from '../../utils/validation'
import { fetchIFSCDetails } from '../../utils/ifscApi'
import { formatCurrency, formatDate, getReferralLink } from '../../utils/helpers'

// Bank Accounts Tab Component
function BankAccountsTab({ userId, financialProfile, fetchingIFSC, setFetchingIFSC }) {
  const [banks, setBanks] = useState([])
  const [showAddBank, setShowAddBank] = useState(false)
  const [editingBankId, setEditingBankId] = useState(null)
  const [bankDetails, setBankDetails] = useState({ bankName: '', branch: '', city: '' })
  const [fetchingIFSCState, setFetchingIFSCState] = useState(false)

  const bankForm = useForm({
    defaultValues: {
      paymentType: 'bank',
      holderName: '',
      accountNumber: '',
      confirmAccountNumber: '',
      ifsc: '',
      accountType: 'savings',
      bankName: '',
      branch: '',
      upiId: '',
      upiName: '',
      isPrimary: false,
    },
  })

  // Load banks from subcollection
  useEffect(() => {
    const loadBanks = async () => {
      try {
        const banksRef = collection(db, 'userFinancialProfiles', userId, 'banks')
        const snapshot = await getDocs(banksRef)
        const banksList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setBanks(banksList)
      } catch (error) {
        console.error('Error loading banks:', error)
        // Fallback to single bank in financialProfile
        if (financialProfile?.bank) {
          setBanks([{ id: 'default', ...financialProfile.bank, paymentType: 'bank' }])
        }
      }
    }
    if (userId) {
      loadBanks()
    }
  }, [userId, financialProfile])

  const handleFetchIFSC = async () => {
    const ifsc = bankForm.getValues('ifsc')
    const ifscError = validateIFSC(ifsc)
    
    if (ifscError) {
      toast.error(ifscError)
      return
    }

    setFetchingIFSCState(true)
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
        toast.success('Bank details fetched successfully')
      } else {
        toast.error(details.error || 'Failed to fetch bank details')
        setBankDetails({ bankName: '', branch: '', city: '' })
      }
    } catch (error) {
      console.error('IFSC fetch error:', error)
      toast.error('Error fetching bank details')
    } finally {
      setFetchingIFSCState(false)
    }
  }

  const onBankSubmit = async (data) => {
    try {
      const paymentType = data.paymentType

      if (paymentType === 'bank') {
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

        const maskedAccount = `XXXXXX${data.accountNumber.slice(-4)}`
        const bankData = {
          paymentType: 'bank',
          holderName: data.holderName,
          accountNumberMasked: maskedAccount,
          accountNumberLast4: data.accountNumber.slice(-4),
          ifsc: data.ifsc.toUpperCase(),
          bankName: bankDetails.bankName || data.bankName || '',
          branch: bankDetails.branch || data.branch || '',
          city: bankDetails.city || '',
          accountType: data.accountType,
          isVerified: false,
          isPrimary: data.isPrimary || false,
          createdAt: new Date(),
        }

        // If setting as primary, unset other primary banks
        if (bankData.isPrimary) {
          for (const bank of banks) {
            if (bank.isPrimary && bank.id !== editingBankId) {
              const bankRef = doc(db, 'userFinancialProfiles', userId, 'banks', bank.id)
              await updateDoc(bankRef, { isPrimary: false })
            }
          }
        }

        if (editingBankId) {
          const bankRef = doc(db, 'userFinancialProfiles', userId, 'banks', editingBankId)
          await updateDoc(bankRef, { ...bankData, updatedAt: new Date() })
          toast.success('Bank details updated')
        } else {
          await addDoc(collection(db, 'userFinancialProfiles', userId, 'banks'), bankData)
          toast.success('Bank details added. Awaiting admin verification.')
        }
      } else if (paymentType === 'upi') {
        const upiError = validateUPI(data.upiId)
        if (upiError) {
          toast.error(upiError)
          return
        }

        const upiData = {
          paymentType: 'upi',
          upiId: data.upiId.toLowerCase(),
          upiName: data.upiName || '',
          isVerified: false,
          isPrimary: data.isPrimary || false,
          createdAt: new Date(),
        }

        // If setting as primary, unset other primary banks
        if (upiData.isPrimary) {
          for (const bank of banks) {
            if (bank.isPrimary && bank.id !== editingBankId) {
              const bankRef = doc(db, 'userFinancialProfiles', userId, 'banks', bank.id)
              await updateDoc(bankRef, { isPrimary: false })
            }
          }
        }

        if (editingBankId) {
          const bankRef = doc(db, 'userFinancialProfiles', userId, 'banks', editingBankId)
          await updateDoc(bankRef, { ...upiData, updatedAt: new Date() })
          toast.success('UPI details updated')
        } else {
          await addDoc(collection(db, 'userFinancialProfiles', userId, 'banks'), upiData)
          toast.success('UPI details added')
        }
      }

      setShowAddBank(false)
      setEditingBankId(null)
      bankForm.reset()
      setBankDetails({ bankName: '', branch: '', city: '' })
      
      // Reload banks
      const banksRef = collection(db, 'userFinancialProfiles', userId, 'banks')
      const snapshot = await getDocs(banksRef)
      const banksList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setBanks(banksList)
    } catch (error) {
      console.error('Bank save error:', error)
      toast.error('Error saving bank details')
    }
  }

  const handleDeleteBank = async (bankId) => {
    const bank = banks.find(b => b.id === bankId)
    if (bank?.isPrimary) {
      toast.error('Cannot delete primary bank. Set another bank as primary first.')
      return
    }

    if (!confirm('Are you sure you want to delete this bank account?')) {
      return
    }

    try {
      const bankRef = doc(db, 'userFinancialProfiles', userId, 'banks', bankId)
      await deleteDoc(bankRef)
      toast.success('Bank account deleted')
      setBanks(banks.filter(b => b.id !== bankId))
    } catch (error) {
      console.error('Delete bank error:', error)
      toast.error('Error deleting bank account')
    }
  }

  const handleSetPrimary = async (bankId) => {
    try {
      // Unset all primary
      for (const bank of banks) {
        if (bank.isPrimary) {
          const bankRef = doc(db, 'userFinancialProfiles', userId, 'banks', bank.id)
          await updateDoc(bankRef, { isPrimary: false })
        }
      }

      // Set new primary
      const bankRef = doc(db, 'userFinancialProfiles', userId, 'banks', bankId)
      await updateDoc(bankRef, { isPrimary: true })
      toast.success('Primary bank updated')
      
      // Reload banks
      const banksRef = collection(db, 'userFinancialProfiles', userId, 'banks')
      const snapshot = await getDocs(banksRef)
      const banksList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setBanks(banksList)
    } catch (error) {
      console.error('Set primary error:', error)
      toast.error('Error updating primary bank')
    }
  }

  const handleEditBank = (bank) => {
    setEditingBankId(bank.id)
    setShowAddBank(true)
    if (bank.paymentType === 'bank') {
      bankForm.reset({
        paymentType: 'bank',
        holderName: bank.holderName || '',
        accountNumber: '',
        confirmAccountNumber: '',
        ifsc: bank.ifsc || '',
        accountType: bank.accountType || 'savings',
        bankName: bank.bankName || '',
        branch: bank.branch || '',
        isPrimary: bank.isPrimary || false,
      })
      setBankDetails({
        bankName: bank.bankName || '',
        branch: bank.branch || '',
        city: bank.city || ''
      })
    } else {
      bankForm.reset({
        paymentType: 'upi',
        upiId: bank.upiId || '',
        upiName: bank.upiName || '',
        isPrimary: bank.isPrimary || false,
      })
    }
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Building2 className="text-primary" size={24} />
          </div>
          Bank Account Information
        </h2>
        <button
          onClick={() => {
            setShowAddBank(true)
            setEditingBankId(null)
            bankForm.reset({
              paymentType: 'bank',
              holderName: '',
              accountNumber: '',
              confirmAccountNumber: '',
              ifsc: '',
              accountType: 'savings',
              bankName: '',
              branch: '',
              upiId: '',
              upiName: '',
              isPrimary: false,
            })
            setBankDetails({ bankName: '', branch: '', city: '' })
          }}
          className="btn-primary hover:bg-primary/90 transition-colors"
        >
          Add Bank / UPI
        </button>
      </div>

      <p className="text-gray-400 mb-4">
        Manage your bank accounts and UPI. Only the primary payment method will be used for payouts.
      </p>

      {/* Existing Banks List */}
      {banks.length > 0 && (
        <div className="space-y-4 mb-6">
          {banks.map((bank) => (
            <div key={bank.id} className="p-4 bg-dark-lighter rounded-lg border border-gray-700 hover:border-primary/50 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <h3 className="font-semibold text-white">
                      {bank.paymentType === 'bank' ? 'Bank Account' : 'UPI'}
                    </h3>
                    {bank.isPrimary && (
                      <span className="badge bg-primary">Primary</span>
                    )}
                    {bank.isVerified ? (
                      <span className="badge bg-green-500">Verified</span>
                    ) : (
                      <span className="badge bg-yellow-500">Pending</span>
                    )}
                  </div>

                  {bank.paymentType === 'bank' ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Account Holder:</span>
                        <span className="text-white font-medium">{bank.holderName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Account Number:</span>
                        <span className="font-mono text-white">{bank.accountNumberMasked || `XXXXXX${bank.accountNumberLast4 || 'XXXX'}`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">IFSC:</span>
                        <span className="font-mono text-white">{bank.ifsc}</span>
                      </div>
                      {bank.bankName && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Bank:</span>
                          <span className="text-white">{bank.bankName}</span>
                        </div>
                      )}
                      {bank.branch && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Branch:</span>
                          <span className="text-white">{bank.branch}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">UPI ID:</span>
                        <span className="text-white font-medium">{bank.upiId}</span>
                      </div>
                      {bank.upiName && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">UPI Name:</span>
                          <span className="text-white">{bank.upiName}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {!bank.isPrimary && (
                    <button
                      onClick={() => handleSetPrimary(bank.id)}
                      className="btn-secondary text-sm hover:bg-primary/20 transition-colors"
                    >
                      Set Primary
                    </button>
                  )}
                  <button
                    onClick={() => handleEditBank(bank)}
                    className="btn-secondary text-sm hover:bg-primary/20 transition-colors"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteBank(bank.id)}
                    className="btn-danger text-sm hover:bg-red-600 transition-colors"
                    disabled={bank.isPrimary}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Bank Form */}
      {showAddBank && (
        <div className="border-t border-gray-700 pt-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingBankId ? 'Edit Payment Method' : 'Add Payment Method'}
          </h3>
          <form onSubmit={bankForm.handleSubmit(onBankSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Payment Type *</label>
              <select
                {...bankForm.register('paymentType', { required: true })}
                className="input-field"
                onChange={(e) => {
                  bankForm.setValue('paymentType', e.target.value)
                  if (e.target.value === 'upi') {
                    setBankDetails({ bankName: '', branch: '', city: '' })
                  }
                }}
              >
                <option value="bank">Bank Account</option>
                <option value="upi">UPI</option>
              </select>
            </div>

            {bankForm.watch('paymentType') === 'bank' ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Account Holder Name *</label>
                  <input
                    type="text"
                    {...bankForm.register('holderName', { required: 'Account holder name is required' })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Account Number *</label>
                  <input
                    type="text"
                    {...bankForm.register('accountNumber', { required: 'Account number is required' })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Confirm Account Number *</label>
                  <input
                    type="text"
                    {...bankForm.register('confirmAccountNumber', { required: 'Please confirm account number' })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">IFSC Code *</label>
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
                      disabled={fetchingIFSCState}
                      className="btn-secondary px-4"
                    >
                      {fetchingIFSCState ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        'Fetch'
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
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Branch</label>
                      <input
                        type="text"
                        {...bankForm.register('branch')}
                        className="input-field"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">Account Type</label>
                  <select {...bankForm.register('accountType')} className="input-field">
                    <option value="savings">Savings</option>
                    <option value="current">Current</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">UPI ID *</label>
                  <input
                    type="text"
                    {...bankForm.register('upiId', { required: 'UPI ID is required' })}
                    className="input-field"
                    placeholder="name@bank"
                  />
                  <p className="text-xs text-gray-400 mt-1">Example: yourname@paytm</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">UPI Name / Platform</label>
                  <input
                    type="text"
                    {...bankForm.register('upiName')}
                    className="input-field"
                    placeholder="e.g., Paytm, PhonePe, Google Pay"
                  />
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...bankForm.register('isPrimary')}
                id="isPrimary"
                className="w-4 h-4 text-primary rounded"
              />
              <label htmlFor="isPrimary" className="text-sm">
                Set as primary payment method
              </label>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn-primary hover:bg-primary/90 transition-colors">
                {editingBankId ? 'Update' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddBank(false)
                  setEditingBankId(null)
                  bankForm.reset()
                  setBankDetails({ bankName: '', branch: '', city: '' })
                }}
                className="btn-secondary hover:bg-dark-lighter transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default function UserProfile() {
  const { user, userData } = useAuth()
  const [activeTab, setActiveTab] = useState('settings')
  const [fetchingIFSC, setFetchingIFSC] = useState(false)
  const [copiedField, setCopiedField] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [showAddBank, setShowAddBank] = useState(false)
  const [editingBankId, setEditingBankId] = useState(null)
  const [kycDocuments, setKycDocuments] = useState({
    panImage: null,
    aadharFront: null,
    aadharBack: null,
    selfie: null
  })

  const userId = user?.uid
  const financialProfileRef = userId ? doc(db, 'userFinancialProfiles', userId) : null
  const { data: financialProfile, loading: profileLoading } = useFirestore(financialProfileRef)
  const { data: userPackages } = useCollection('userPackages', [])
  const { data: kycRequests } = useCollection('kycRequests', [])

  // Get active package
  const activePackage = useMemo(() => {
    if (!userId) return null
    const active = userPackages.filter(pkg => pkg.userId === userId && pkg.status === 'active')
    if (active.length === 0) return null
    
    // Prioritize Investor plans over Leader Program
    const investorPlan = active.find(pkg => 
      pkg.packageId !== 'LEADER_PROGRAM' && pkg.packageName !== 'Leader Program'
    )
    if (investorPlan) return investorPlan
    
    // If multiple, prefer higher amount
    return active.reduce((prev, current) => {
      const prevAmount = prev.amount || prev.inrPrice || 0
      const currentAmount = current.amount || current.inrPrice || 0
      return currentAmount > prevAmount ? current : prev
    })
  }, [userPackages, userId])

  // Get user's KYC request
  const userKycRequest = useMemo(() => {
    if (!userId || !kycRequests) return null
    return kycRequests.find(kyc => kyc.userId === userId)
  }, [kycRequests, userId])

  // Get sponsor info
  const sponsorId = userData?.referredByUserId || userData?.referredByUid || 'N/A'
  const referralLink = userData?.refCode ? getReferralLink(userData.refCode) : ''

  // Copy to clipboard helper
  const copyToClipboard = (text, fieldName) => {
    if (text && text !== 'N/A') {
      navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      toast.success(`${fieldName} copied to clipboard!`)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  // Share referral link
  const shareReferralLink = async () => {
    if (!referralLink) {
      toast.error('Referral link not available')
      return
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on MTN',
          text: 'Check out this amazing opportunity!',
          url: referralLink,
        })
        toast.success('Referral link shared!')
      } catch (error) {
        if (error.name !== 'AbortError') {
          copyToClipboard(referralLink, 'Referral Link')
        }
      }
    } else {
      copyToClipboard(referralLink, 'Referral Link')
    }
  }

  // Profile Photo Upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
      toast.error('Only JPG and PNG images are allowed')
      return
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB')
      return
    }

    // Preview
    const reader = new FileReader()
    reader.onload = (e) => setPhotoPreview(e.target.result)
    reader.readAsDataURL(file)

    setUploadingPhoto(true)
    try {
      const storageRef = ref(storage, `users/${userId}/profile-photo-${Date.now()}`)
      await uploadBytes(storageRef, file)
      const photoUrl = await getDownloadURL(storageRef)

      await updateDoc(doc(db, 'users', userId), {
        photoURL: photoUrl,
        updatedAt: new Date()
      })

      toast.success('Profile photo updated successfully')
    } catch (error) {
      console.error('Photo upload error:', error)
      toast.error('Error uploading photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  // Forms
  const personalForm = useForm({
    defaultValues: {
      name: userData?.name || '',
      phone: userData?.phone || '',
      dateOfBirth: userData?.dateOfBirth || '',
      gender: userData?.gender || '',
      upiId: financialProfile?.upi?.upiId || '',
      walletAddress: financialProfile?.walletAddress || '',
      nomineeName: userData?.nominee?.name || '',
      nomineeRelationship: userData?.nominee?.relationship || '',
      nomineeMobile: userData?.nominee?.mobile || '',
    },
  })

  const addressForm = useForm({
    defaultValues: {
      addressLine1: userData?.address?.line1 || '',
      addressLine2: userData?.address?.line2 || '',
      landmark: userData?.address?.landmark || '',
      district: userData?.address?.district || '',
      city: userData?.address?.city || '',
      state: userData?.address?.state || '',
      pinCode: userData?.address?.pinCode || '',
    },
  })

  const kycForm = useForm({
    defaultValues: {
      panNumber: userData?.panNumber || '',
      aadharNumber: userData?.aadharNumber || '',
    },
  })

  const passwordForm = useForm()

  // Update forms when data loads
  useEffect(() => {
    if (userData) {
      personalForm.reset({
        name: userData.name || '',
        phone: userData.phone || '',
        dateOfBirth: userData.dateOfBirth || '',
        gender: userData.gender || '',
        upiId: financialProfile?.upi?.upiId || '',
        walletAddress: financialProfile?.walletAddress || '',
        nomineeName: userData.nominee?.name || '',
        nomineeRelationship: userData.nominee?.relationship || '',
        nomineeMobile: userData.nominee?.mobile || '',
      })
    }
  }, [userData, financialProfile])

  useEffect(() => {
    if (userData?.address) {
      addressForm.reset({
        addressLine1: userData.address.line1 || '',
        addressLine2: userData.address.line2 || '',
        landmark: userData.address.landmark || '',
        district: userData.address.district || '',
        city: userData.address.city || '',
        state: userData.address.state || '',
        pinCode: userData.address.pinCode || '',
      })
    }
  }, [userData])

  // Get account status badge
  const getAccountStatusBadge = () => {
    const status = userData?.status || 'active'
    if (status === 'active' || status === 'ACTIVE_INVESTOR' || status === 'ACTIVE_LEADER') {
      return <span className="badge bg-green-500">Active</span>
    }
    if (status === 'PENDING_ACTIVATION') {
      return <span className="badge bg-yellow-500">Pending</span>
    }
    if (status === 'blocked' || status === 'AUTO_BLOCKED') {
      return <span className="badge bg-red-500">Blocked</span>
    }
    if (activePackage?.capStatus === 'CAP_REACHED') {
      return <span className="badge bg-orange-500">Cap Reached</span>
    }
    return <span className="badge bg-gray-500">{status}</span>
  }

  // Get KYC status badge
  const getKycStatusBadge = () => {
    if (!userKycRequest) {
      return <span className="badge bg-gray-500">Not Submitted</span>
    }
    const status = userKycRequest.status || 'pending'
    if (status === 'approved') {
      return <span className="badge bg-green-500">Approved</span>
    }
    if (status === 'rejected') {
      return <span className="badge bg-red-500">Rejected</span>
    }
    return <span className="badge bg-yellow-500">Pending</span>
  }

  // Get program type badge
  const getProgramTypeBadge = () => {
    const programType = userData?.programType || ''
    if (programType === 'investor') {
      return <span className="badge bg-blue-500">Investor</span>
    }
    if (programType === 'leader') {
      return <span className="badge bg-purple-500">Leader</span>
    }
    return <span className="badge bg-gray-500">None</span>
  }

  // Personal Details Submit
  const onPersonalSubmit = async (data) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        name: data.name,
        phone: data.phone.replace(/[\s\-\(\)]/g, ''),
        dateOfBirth: data.dateOfBirth || null,
        gender: data.gender || null,
        nominee: {
          name: data.nomineeName || null,
          relationship: data.nomineeRelationship || null,
          mobile: data.nomineeMobile || null,
        },
        updatedAt: new Date(),
      })

      // Update UPI and wallet in financial profile
      if (data.upiId || data.walletAddress) {
        const financialData = {}
        if (data.upiId) {
          const upiError = validateUPI(data.upiId)
          if (upiError) {
            toast.error(upiError)
            return
          }
          financialData.upi = { upiId: data.upiId.toLowerCase(), isVerified: false }
        }
        if (data.walletAddress) {
          financialData.walletAddress = data.walletAddress
        }
        financialData.updatedAt = new Date()
        await setDoc(doc(db, 'userFinancialProfiles', userId), financialData, { merge: true })
      }

      toast.success('Personal details updated successfully')
    } catch (error) {
      console.error('Profile update error:', error)
      toast.error('Error updating profile')
    }
  }

  // Address Submit
  const onAddressSubmit = async (data) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        address: {
          line1: data.addressLine1,
          line2: data.addressLine2,
          landmark: data.landmark,
          district: data.district,
          city: data.city,
          state: data.state,
          pinCode: data.pinCode,
        },
        updatedAt: new Date(),
      })
      toast.success('Address updated successfully')
    } catch (error) {
      console.error('Address update error:', error)
      toast.error('Error updating address')
    }
  }

  // KYC Submit
  const onKycSubmit = async (data) => {
    try {
      // Validate PAN
      if (!data.panNumber || data.panNumber.length !== 10) {
        toast.error('PAN number must be 10 characters')
        return
      }

      // Check if documents are uploaded
      if (!kycDocuments.panImage) {
        toast.error('Please upload PAN image')
        return
      }

      // Upload documents to Firebase Storage
      const uploadedDocs = {}
      for (const [key, file] of Object.entries(kycDocuments)) {
        if (file) {
          const storageRef = ref(storage, `users/${userId}/kyc/${key}-${Date.now()}`)
          await uploadBytes(storageRef, file)
          uploadedDocs[key] = await getDownloadURL(storageRef)
        }
      }

      // Create KYC request
      const kycRequestData = {
        userId,
        userEmail: user.email,
        userName: userData.name,
        panNumber: data.panNumber.toUpperCase(),
        aadharNumber: data.aadharNumber || null,
        documents: uploadedDocs,
        status: 'pending',
        submittedAt: new Date(),
      }

      await addDoc(collection(db, 'kycRequests'), kycRequestData)

      // Update user with PAN number
      await updateDoc(doc(db, 'users', userId), {
        panNumber: data.panNumber.toUpperCase(),
        aadharNumber: data.aadharNumber || null,
        updatedAt: new Date(),
      })

      toast.success('KYC request submitted successfully')
      setKycDocuments({ panImage: null, aadharFront: null, aadharBack: null, selfie: null })
      kycForm.reset()
    } catch (error) {
      console.error('KYC submit error:', error)
      toast.error('Error submitting KYC request')
    }
  }

  // Password Change
  const onChangePassword = async (data) => {
    try {
      const { updatePassword, reauthenticateWithCredential, EmailAuthProvider } = await import('firebase/auth')
      const { auth } = await import('../../config/firebase')
      
      if (data.newPassword !== data.confirmNewPassword) {
        toast.error('Passwords do not match')
        return
      }

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, data.currentPassword)
      await reauthenticateWithCredential(user, credential)

      // Update password
      await updatePassword(user, data.newPassword)
      toast.success('Password changed successfully')
      passwordForm.reset()
    } catch (error) {
      console.error('Password change error:', error)
      if (error.code === 'auth/wrong-password') {
        toast.error('Current password is incorrect')
      } else {
        toast.error(error.message || 'Error changing password')
      }
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent flex items-center gap-3">
          <User className="text-primary" size={36} />
          My Profile
        </h1>
        <p className="text-gray-400">Manage your account settings and personal information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Settings Card - Top Right */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <User className="text-primary" size={24} />
              </div>
              User Settings
            </h2>
            
            <div className="space-y-4">
              {/* User ID */}
              <div>
                <label className="block text-sm font-medium mb-2 text-white">User ID</label>
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
                      onClick={() => copyToClipboard(userData.userId, 'User ID')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                    >
                      {copiedField === 'User ID' ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Sponsor ID */}
              <div>
                <label className="block text-sm font-medium mb-2 text-white">Sponsor ID / Referral ID</label>
                <div className="relative">
                  <input
                    type="text"
                    value={sponsorId}
                    disabled
                    className="input-field bg-dark-lighter opacity-50 cursor-not-allowed pr-10"
                  />
                  {sponsorId !== 'N/A' && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(sponsorId, 'Sponsor ID')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                    >
                      {copiedField === 'Sponsor ID' ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Referral Link */}
              <div>
                <label className="block text-sm font-medium mb-2 text-white">Referral Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={referralLink}
                    disabled
                    className="input-field bg-dark-lighter opacity-50 cursor-not-allowed flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(referralLink, 'Referral Link')}
                    className="btn-secondary px-3 hover:bg-primary/20 transition-colors"
                    title="Copy"
                  >
                    {copiedField === 'Referral Link' ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                  </button>
                  <button
                    type="button"
                    onClick={shareReferralLink}
                    className="btn-secondary px-3 hover:bg-primary/20 transition-colors"
                    title="Share"
                  >
                    <Share2 size={18} />
                  </button>
                </div>
              </div>

              {/* Program Type */}
              <div>
                <label className="block text-sm font-medium mb-2 text-white">Program Type</label>
                <div>{getProgramTypeBadge()}</div>
              </div>

              {/* Account Status */}
              <div>
                <label className="block text-sm font-medium mb-2 text-white">Account Status</label>
                <div>{getAccountStatusBadge()}</div>
              </div>

              {/* KYC Status */}
              <div>
                <label className="block text-sm font-medium mb-2 text-white">KYC Status</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {getKycStatusBadge()}
                  {(!userKycRequest || userKycRequest.status === 'rejected') && (
                    <button
                      onClick={() => setActiveTab('kyc')}
                      className="btn-primary text-sm px-3 py-1.5 hover:bg-primary/90 transition-colors"
                    >
                      Submit KYC
                    </button>
                  )}
                </div>
              </div>

              {/* Activation Date */}
              <div>
                <label className="block text-sm font-medium mb-2 text-white">Activation Date</label>
                <input
                  type="text"
                  value={activePackage?.activatedAt ? formatDate(activePackage.activatedAt) : 'Not Activated'}
                  disabled
                  className="input-field bg-dark-lighter opacity-50 cursor-not-allowed"
                />
              </div>

              {/* Plan/Package */}
              <div>
                <label className="block text-sm font-medium mb-2 text-white">Plan/Package</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={activePackage?.packageName || 'No Active Package'}
                    disabled
                    className="input-field bg-dark-lighter opacity-50 cursor-not-allowed"
                  />
                  {activePackage && (
                    <input
                      type="text"
                      value={formatCurrency(activePackage.amount || activePackage.inrPrice || 0, 'INR')}
                      disabled
                      className="input-field bg-dark-lighter opacity-50 cursor-not-allowed"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Profile Photo Card */}
          <div className="card">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Camera className="text-primary" size={24} />
              </div>
              Profile Photo
            </h2>
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                {userData?.photoURL || photoPreview ? (
                  <img
                    src={photoPreview || userData.photoURL}
                    alt="Profile"
                    className="w-32 h-32 rounded-full object-cover border-4 border-primary shadow-lg shadow-primary/20"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-4 border-primary shadow-lg shadow-primary/20">
                    <User size={48} className="text-gray-400" />
                  </div>
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                    <Loader2 className="animate-spin text-primary" size={24} />
                  </div>
                )}
              </div>
              <label className="btn-secondary cursor-pointer hover:bg-primary/10 transition-colors">
                <Upload size={18} className="mr-2" />
                {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploadingPhoto}
                />
              </label>
              <p className="text-xs text-gray-400 text-center">
                JPG or PNG, max 2MB
              </p>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-2">
          <div className="mb-6">
            <div className="flex gap-2 border-b border-gray-700 overflow-x-auto">
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-3 font-medium whitespace-nowrap transition-all ${
                  activeTab === 'settings'
                    ? 'border-b-2 border-primary text-primary bg-primary/5'
                    : 'text-gray-400 hover:text-white hover:bg-dark-lighter'
                }`}
              >
                Settings
              </button>
              <button
                onClick={() => setActiveTab('address')}
                className={`px-4 py-3 font-medium whitespace-nowrap transition-all ${
                  activeTab === 'address'
                    ? 'border-b-2 border-primary text-primary bg-primary/5'
                    : 'text-gray-400 hover:text-white hover:bg-dark-lighter'
                }`}
              >
                Address
              </button>
              <button
                onClick={() => setActiveTab('bank')}
                className={`px-4 py-3 font-medium whitespace-nowrap transition-all ${
                  activeTab === 'bank'
                    ? 'border-b-2 border-primary text-primary bg-primary/5'
                    : 'text-gray-400 hover:text-white hover:bg-dark-lighter'
                }`}
              >
                Bank Accounts
              </button>
              <button
                onClick={() => setActiveTab('kyc')}
                className={`px-4 py-3 font-medium whitespace-nowrap transition-all ${
                  activeTab === 'kyc'
                    ? 'border-b-2 border-primary text-primary bg-primary/5'
                    : 'text-gray-400 hover:text-white hover:bg-dark-lighter'
                }`}
              >
                KYC Verification
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`px-4 py-3 font-medium whitespace-nowrap transition-all ${
                  activeTab === 'security'
                    ? 'border-b-2 border-primary text-primary bg-primary/5'
                    : 'text-gray-400 hover:text-white hover:bg-dark-lighter'
                }`}
              >
                Security
              </button>
            </div>
          </div>

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="card">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <User className="text-primary" size={24} />
                </div>
                Personal Information
              </h2>
              <form onSubmit={personalForm.handleSubmit(onPersonalSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">Full Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      {...personalForm.register('name', { required: 'Name is required' })}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">Email</label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="input-field bg-dark-lighter opacity-50 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">Mobile Number</label>
                    <input
                      type="tel"
                      {...personalForm.register('phone')}
                      className="input-field"
                      placeholder="10 digit mobile number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">Date of Birth</label>
                    <input
                      type="date"
                      {...personalForm.register('dateOfBirth')}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">Gender</label>
                    <select {...personalForm.register('gender')} className="input-field">
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">UPI ID</label>
                    <input
                      type="text"
                      {...personalForm.register('upiId')}
                      className="input-field"
                      placeholder="name@bank"
                    />
                    <p className="text-xs text-gray-400 mt-1">Example: yourname@paytm</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Wallet Address (USDT/BNB)</label>
                    <input
                      type="text"
                      {...personalForm.register('walletAddress')}
                      className="input-field"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                {/* Nominee Details */}
                <div className="border-t border-gray-700 pt-6">
                  <h3 className="text-lg font-semibold mb-4">Nominee Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Nominee Name</label>
                      <input
                        type="text"
                        {...personalForm.register('nomineeName')}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Relationship</label>
                      <select {...personalForm.register('nomineeRelationship')} className="input-field">
                        <option value="">Select</option>
                        <option value="spouse">Spouse</option>
                        <option value="father">Father</option>
                        <option value="mother">Mother</option>
                        <option value="son">Son</option>
                        <option value="daughter">Daughter</option>
                        <option value="brother">Brother</option>
                        <option value="sister">Sister</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Nominee Mobile</label>
                      <input
                        type="tel"
                        {...personalForm.register('nomineeMobile')}
                        className="input-field"
                        placeholder="10 digit mobile number"
                      />
                    </div>
                  </div>
                </div>

                <button type="submit" className="btn-primary w-full md:w-auto px-6 py-3 font-semibold hover:bg-primary/90 transition-colors">
                  Update Personal Details
                </button>
              </form>
            </div>
          )}

          {/* Address Tab */}
          {activeTab === 'address' && (
            <div className="card">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <MapPin className="text-primary" size={24} />
                </div>
                Address Information
              </h2>
              <form onSubmit={addressForm.handleSubmit(onAddressSubmit)} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">Address Line 1 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    {...addressForm.register('addressLine1', { required: 'Address Line 1 is required' })}
                    className="input-field"
                    placeholder="House/Flat No., Building Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-white">Address Line 2</label>
                  <input
                    type="text"
                    {...addressForm.register('addressLine2')}
                    className="input-field"
                    placeholder="Street, Area, Locality"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-white">Landmark</label>
                  <input
                    type="text"
                    {...addressForm.register('landmark')}
                    className="input-field"
                    placeholder="Nearby landmark"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">District <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      {...addressForm.register('district', { required: 'District is required' })}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">City</label>
                    <input
                      type="text"
                      {...addressForm.register('city')}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">State</label>
                    <input
                      type="text"
                      {...addressForm.register('state')}
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-white">Pin Code</label>
                  <input
                    type="text"
                    {...addressForm.register('pinCode')}
                    className="input-field"
                    placeholder="6 digit pin code"
                    maxLength={6}
                  />
                </div>

                <button type="submit" className="btn-primary w-full md:w-auto px-6 py-3 font-semibold hover:bg-primary/90 transition-colors">
                  Update Address
                </button>
              </form>
            </div>
          )}

          {/* Bank Accounts Tab */}
          {activeTab === 'bank' && (
            <BankAccountsTab 
              userId={userId}
              financialProfile={financialProfile}
              fetchingIFSC={fetchingIFSC}
              setFetchingIFSC={setFetchingIFSC}
            />
          )}

          {/* KYC Tab */}
          {activeTab === 'kyc' && (
            <div className="card">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileCheck className="text-primary" size={24} />
                </div>
                KYC Verification
              </h2>

              {userKycRequest && (
                <div className="mb-6 p-4 bg-dark-lighter rounded-lg border border-gray-700">
                  <h3 className="font-semibold mb-3 text-white">Current KYC Status</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Status:</span>
                      {getKycStatusBadge()}
                    </div>
                    {userKycRequest.submittedAt && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Submitted:</span>
                        <span className="text-white">{formatDate(userKycRequest.submittedAt)}</span>
                      </div>
                    )}
                    {userKycRequest.status === 'rejected' && userKycRequest.adminRemarks && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <span className="text-gray-400 text-sm">Admin Remarks:</span>
                        <p className="text-red-400 mt-1">{userKycRequest.adminRemarks}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(!userKycRequest || userKycRequest.status === 'rejected') && (
                <form onSubmit={kycForm.handleSubmit(onKycSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">PAN Number <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        {...kycForm.register('panNumber', { 
                          required: 'PAN number is required',
                          pattern: {
                            value: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
                            message: 'Invalid PAN format (e.g., ABCDE1234F)'
                          }
                        })}
                        className="input-field uppercase"
                        placeholder="ABCDE1234F"
                        maxLength={10}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">Aadhar / Govt ID Number</label>
                      <input
                        type="text"
                        {...kycForm.register('aadharNumber')}
                        className="input-field"
                        placeholder="Optional"
                        maxLength={12}
                      />
                    </div>
                  </div>

                  {/* Document Uploads */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-white mb-4">Upload Documents</h3>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">PAN Image <span className="text-red-500">*</span></label>
                      <label className="btn-secondary cursor-pointer inline-flex items-center gap-2 hover:bg-primary/10 transition-colors">
                        <Upload size={18} />
                        {kycDocuments.panImage ? kycDocuments.panImage.name : 'Upload PAN Image'}
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          onChange={(e) => setKycDocuments({...kycDocuments, panImage: e.target.files[0]})}
                          className="hidden"
                        />
                      </label>
                      {kycDocuments.panImage && (
                        <p className="text-sm text-gray-400 mt-2 flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-500" />
                          {kycDocuments.panImage.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">Aadhar Front / ID Proof</label>
                      <label className="btn-secondary cursor-pointer inline-flex items-center gap-2 hover:bg-primary/10 transition-colors">
                        <Upload size={18} />
                        {kycDocuments.aadharFront ? kycDocuments.aadharFront.name : 'Upload Aadhar Front'}
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          onChange={(e) => setKycDocuments({...kycDocuments, aadharFront: e.target.files[0]})}
                          className="hidden"
                        />
                      </label>
                      {kycDocuments.aadharFront && (
                        <p className="text-sm text-gray-400 mt-2 flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-500" />
                          {kycDocuments.aadharFront.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">Aadhar Back</label>
                      <label className="btn-secondary cursor-pointer inline-flex items-center gap-2 hover:bg-primary/10 transition-colors">
                        <Upload size={18} />
                        {kycDocuments.aadharBack ? kycDocuments.aadharBack.name : 'Upload Aadhar Back'}
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          onChange={(e) => setKycDocuments({...kycDocuments, aadharBack: e.target.files[0]})}
                          className="hidden"
                        />
                      </label>
                      {kycDocuments.aadharBack && (
                        <p className="text-sm text-gray-400 mt-2 flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-500" />
                          {kycDocuments.aadharBack.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-white">Selfie (Optional)</label>
                      <label className="btn-secondary cursor-pointer inline-flex items-center gap-2 hover:bg-primary/10 transition-colors">
                        <Upload size={18} />
                        {kycDocuments.selfie ? kycDocuments.selfie.name : 'Upload Selfie'}
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          onChange={(e) => setKycDocuments({...kycDocuments, selfie: e.target.files[0]})}
                          className="hidden"
                        />
                      </label>
                      {kycDocuments.selfie && (
                        <p className="text-sm text-gray-400 mt-2 flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-500" />
                          {kycDocuments.selfie.name}
                        </p>
                      )}
                    </div>
                  </div>

                  <button type="submit" className="btn-primary w-full md:w-auto px-6 py-3 font-semibold hover:bg-primary/90 transition-colors">
                    Submit KYC Request
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="card">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Lock className="text-primary" size={24} />
                </div>
                Security Settings
              </h2>

              {/* Last Login Info */}
              <div className="mb-6 p-4 bg-dark-lighter rounded-lg border border-gray-700">
                <h3 className="font-semibold mb-4 text-white">Login Information</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Last Login:</span>
                    <span className="text-white">{user?.metadata?.lastSignInTime ? formatDate(new Date(user.metadata.lastSignInTime)) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Account Created:</span>
                    <span className="text-white">{user?.metadata?.creationTime ? formatDate(new Date(user.metadata.creationTime)) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Email Verified:</span>
                    <span>{user?.emailVerified ? (
                      <span className="text-green-500 flex items-center gap-1">
                        <CheckCircle size={16} /> Verified
                      </span>
                    ) : (
                      <span className="text-yellow-500">Not Verified</span>
                    )}</span>
                  </div>
                </div>
              </div>

              {/* Change Password */}
              <div className="mb-6">
                <h3 className="font-semibold mb-4 text-white">Change Password</h3>
                <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">Current Password <span className="text-red-500">*</span></label>
                    <input
                      type="password"
                      {...passwordForm.register('currentPassword', { required: 'Current password is required' })}
                      className="input-field"
                      placeholder="Enter current password"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">New Password <span className="text-red-500">*</span></label>
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
                    <label className="block text-sm font-medium mb-2 text-white">Confirm New Password <span className="text-red-500">*</span></label>
                    <input
                      type="password"
                      {...passwordForm.register('confirmNewPassword', { required: 'Please confirm new password' })}
                      className="input-field"
                      placeholder="Re-enter new password"
                    />
                  </div>

                  <button type="submit" className="btn-primary w-full md:w-auto px-6 py-3 font-semibold hover:bg-primary/90 transition-colors">
                    Change Password
                  </button>
                </form>
              </div>

              {/* Logout All Devices */}
              <div className="border-t border-gray-700 pt-6">
                <h3 className="font-semibold mb-4 text-white">Device Management</h3>
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
                  <p className="text-sm text-yellow-500 flex items-start gap-2">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    Logging out from all devices will invalidate all active sessions. You'll need to login again on all devices.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm('Are you sure you want to logout from all devices? You will need to login again.')) {
                      return
                    }
                    try {
                      // Note: Firebase Auth doesn't have a built-in "logout all devices" feature
                      // This would typically require a Cloud Function to revoke refresh tokens
                      toast.info('Logout all devices feature requires backend implementation. Please contact support.')
                    } catch (error) {
                      console.error('Logout all error:', error)
                      toast.error('Error logging out from all devices')
                    }
                  }}
                  className="btn-secondary hover:bg-red-500/10 hover:text-red-400 transition-colors"
                >
                  Logout All Devices
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  This feature requires backend implementation. Contact support for assistance.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
