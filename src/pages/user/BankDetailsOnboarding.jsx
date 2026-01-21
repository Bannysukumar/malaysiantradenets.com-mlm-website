import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { doc, setDoc, getDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { CreditCard, AlertCircle, CheckCircle } from 'lucide-react'
import { fetchIFSCDetails } from '../../utils/ifscApi'
import { validateIFSC, validateAccountNumber, validateUPI } from '../../utils/validation'
import { useFirestore } from '../../hooks/useFirestore'

export default function BankDetailsOnboarding() {
  const { user, userData } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [fetchingIFSC, setFetchingIFSC] = useState(false)
  const [bankDetails, setBankDetails] = useState(null)
  
  const userId = user?.uid || userData?.uid
  const financialProfileRef = userId ? doc(db, 'userFinancialProfiles', userId) : null
  const { data: existingFinancialProfile, loading: profileLoading } = useFirestore(financialProfileRef)
  
  // Check if bank details already exist and redirect
  useEffect(() => {
    if (userData?.bankDetailsCompleted || (existingFinancialProfile?.bank && existingFinancialProfile.bank.holderName)) {
      toast.success('Bank details already completed')
      if (!userData?.programType) {
        navigate('/app/choose-program', { replace: true })
      } else {
        navigate('/app/dashboard', { replace: true })
      }
    }
  }, [userData, existingFinancialProfile, navigate])

  const { register, handleSubmit, formState: { errors }, watch, setValue, reset } = useForm({
    defaultValues: {
      accountHolderName: existingFinancialProfile?.bank?.holderName || '',
      accountNumber: '',
      confirmAccountNumber: '',
      ifscCode: existingFinancialProfile?.bank?.ifsc || '',
      bankName: existingFinancialProfile?.bank?.bankName || '',
      branch: existingFinancialProfile?.bank?.branch || '',
      accountType: existingFinancialProfile?.bank?.accountType || 'savings',
      upiId: existingFinancialProfile?.upi?.upiId || ''
    }
  })
  
  // Update form when existing profile loads
  useEffect(() => {
    if (existingFinancialProfile?.bank && !userData?.bankDetailsCompleted) {
      reset({
        accountHolderName: existingFinancialProfile.bank.holderName || '',
        accountNumber: '',
        confirmAccountNumber: '',
        ifscCode: existingFinancialProfile.bank.ifsc || '',
        bankName: existingFinancialProfile.bank.bankName || '',
        branch: existingFinancialProfile.bank.branch || '',
        accountType: existingFinancialProfile.bank.accountType || 'savings',
        upiId: existingFinancialProfile?.upi?.upiId || ''
      })
      if (existingFinancialProfile.bank.ifsc) {
        setBankDetails({
          bank: existingFinancialProfile.bank.bankName,
          branch: existingFinancialProfile.bank.branch,
          city: existingFinancialProfile.bank.city
        })
      }
    }
  }, [existingFinancialProfile, reset, userData])

  const accountNumber = watch('accountNumber')
  const confirmAccountNumber = watch('confirmAccountNumber')
  const ifscCode = watch('ifscCode')

  const handleIFSCLookup = async () => {
    if (!ifscCode || ifscCode.length !== 11) {
      toast.error('Please enter a valid 11-character IFSC code')
      return
    }

    const ifscError = validateIFSC(ifscCode)
    if (ifscError) {
      toast.error(ifscError)
      return
    }

    setFetchingIFSC(true)
    try {
      const details = await fetchIFSCDetails(ifscCode)
      if (details && details.valid) {
        setBankDetails(details)
        setValue('bankName', details.bank || '')
        setValue('branch', details.branch || '')
        toast.success('Bank details fetched successfully')
      } else {
        toast.error(details?.error || 'Could not fetch bank details. Please enter manually.')
      }
    } catch (error) {
      console.error('IFSC lookup error:', error)
      toast.error('Error fetching bank details. Please enter manually.')
    } finally {
      setFetchingIFSC(false)
    }
  }

  const onSubmit = async (data) => {
    // Validate account numbers match
    if (data.accountNumber !== data.confirmAccountNumber) {
      toast.error('Account numbers do not match')
      return
    }

    // Validate account number
    const accountError = validateAccountNumber(data.accountNumber, data.confirmAccountNumber)
    if (accountError) {
      toast.error(accountError)
      return
    }

    // Validate IFSC
    const ifscError = validateIFSC(data.ifscCode)
    if (ifscError) {
      toast.error(ifscError)
      return
    }

    // Validate UPI if provided
    if (data.upiId) {
      const upiError = validateUPI(data.upiId)
      if (upiError) {
        toast.error(upiError)
        return
      }
    }

    setLoading(true)
    try {
      const userId = user?.uid || userData?.uid
      if (!userId) {
        toast.error('User not found')
        return
      }

      // Mask account number (store only last 4 digits)
      const accountNumberMasked = `XXXXXX${data.accountNumber.slice(-4)}`
      const accountNumberLast4 = data.accountNumber.slice(-4)

      // Save bank details to banks subcollection (new structure) for automatic verification submission
      const bankData = {
        paymentType: 'bank',
        holderName: data.accountHolderName,
        accountNumberMasked: accountNumberMasked,
        accountNumberLast4: accountNumberLast4,
        ifsc: data.ifscCode.toUpperCase(),
        bankName: data.bankName || bankDetails?.bank || '',
        branch: data.branch || bankDetails?.branch || '',
        city: bankDetails?.city || '',
        accountType: data.accountType,
        isVerified: false, // Submitted for admin verification
        isPrimary: true, // First bank is set as primary
        createdAt: serverTimestamp()
      }

      // Add to banks subcollection
      await addDoc(collection(db, 'userFinancialProfiles', userId, 'banks'), bankData)

      // Also save UPI if provided
      if (data.upiId) {
        const upiData = {
          paymentType: 'upi',
          upiId: data.upiId.toLowerCase(),
          isVerified: false, // Submitted for admin verification
          isPrimary: false,
          createdAt: serverTimestamp()
        }
        await addDoc(collection(db, 'userFinancialProfiles', userId, 'banks'), upiData)
      }

      // Also maintain legacy structure for backward compatibility
      await setDoc(doc(db, 'userFinancialProfiles', userId), {
        bank: {
          holderName: data.accountHolderName,
          accountNumberMasked: accountNumberMasked,
          accountNumberLast4: accountNumberLast4,
          ifsc: data.ifscCode.toUpperCase(),
          bankName: data.bankName || bankDetails?.bank || '',
          branch: data.branch || bankDetails?.branch || '',
          city: bankDetails?.city || '',
          accountType: data.accountType,
          isVerified: false // Admin must verify
        },
        upi: data.upiId ? {
          upiId: data.upiId,
          isVerified: false
        } : null,
        updatedAt: serverTimestamp()
      }, { merge: true })

      // Mark bank details as completed
      await setDoc(doc(db, 'users', userId), {
        bankDetailsCompleted: true,
        updatedAt: serverTimestamp()
      }, { merge: true })

      toast.success('Bank details saved and submitted for verification!')
      
      // Redirect based on program selection status
      setTimeout(() => {
        if (!userData?.programType) {
          navigate('/app/choose-program', { replace: true })
        } else {
          navigate('/app/dashboard', { replace: true })
        }
      }, 1500)
    } catch (error) {
      console.error('Error saving bank details:', error)
      toast.error('Error saving bank details')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-16 px-4">
      <div className="max-w-2xl w-full">
        <div className="card">
          <div className="flex items-center gap-4 mb-6">
            <CreditCard className="text-primary" size={32} />
            <div>
              <h1 className="text-3xl font-bold">Complete Your Bank Details</h1>
              <p className="text-gray-400 mt-1">Required to proceed with your account</p>
            </div>
          </div>

          <div className="bg-blue-500 bg-opacity-20 border border-blue-500 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-blue-500 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-blue-300">
                <p className="font-semibold mb-1">Why we need this:</p>
                <p>Your bank details are required for withdrawals and account verification. All information is encrypted and secure.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Account Holder Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Account Holder Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('accountHolderName', { required: 'Account holder name is required' })}
                className="input-field"
                placeholder="Enter account holder name as per bank records"
              />
              {errors.accountHolderName && (
                <p className="text-red-500 text-sm mt-1">{errors.accountHolderName.message}</p>
              )}
            </div>

            {/* Account Number */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Account Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('accountNumber', { 
                  required: 'Account number is required',
                  minLength: { value: 9, message: 'Account number must be at least 9 digits' },
                  maxLength: { value: 18, message: 'Account number must be at most 18 digits' }
                })}
                className="input-field"
                placeholder="Enter your account number"
              />
              {errors.accountNumber && (
                <p className="text-red-500 text-sm mt-1">{errors.accountNumber.message}</p>
              )}
            </div>

            {/* Confirm Account Number */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Confirm Account Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('confirmAccountNumber', { 
                  required: 'Please confirm account number',
                  validate: value => value === accountNumber || 'Account numbers do not match'
                })}
                className="input-field"
                placeholder="Re-enter account number"
              />
              {errors.confirmAccountNumber && (
                <p className="text-red-500 text-sm mt-1">{errors.confirmAccountNumber.message}</p>
              )}
            </div>

            {/* IFSC Code */}
            <div>
              <label className="block text-sm font-medium mb-2">
                IFSC Code <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  {...register('ifscCode', { 
                    required: 'IFSC code is required',
                    validate: (value) => {
                      if (!value) return 'IFSC code is required'
                      const trimmed = value.trim().toUpperCase()
                      const ifscError = validateIFSC(trimmed)
                      return ifscError || true
                    }
                  })}
                  className="input-field flex-1 uppercase"
                  placeholder="SBIN0001234"
                  maxLength={11}
                  onChange={(e) => {
                    // Remove spaces and special characters, convert to uppercase
                    const cleaned = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 11)
                    setValue('ifscCode', cleaned, { shouldValidate: false })
                  }}
                  onBlur={() => {
                    if (ifscCode && ifscCode.length === 11) {
                      handleIFSCLookup()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleIFSCLookup}
                  disabled={fetchingIFSC || !ifscCode || ifscCode.length !== 11}
                  className="btn-secondary whitespace-nowrap"
                >
                  {fetchingIFSC ? 'Fetching...' : 'Auto-fill'}
                </button>
              </div>
              {errors.ifscCode && (
                <p className="text-red-500 text-sm mt-1">{errors.ifscCode.message}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">Enter IFSC code and click Auto-fill to fetch bank details</p>
            </div>

            {/* Bank Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Bank Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('bankName', { required: 'Bank name is required' })}
                className="input-field"
                placeholder="Bank name (auto-filled from IFSC)"
                readOnly={!!bankDetails}
              />
              {errors.bankName && (
                <p className="text-red-500 text-sm mt-1">{errors.bankName.message}</p>
              )}
            </div>

            {/* Branch */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Branch <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('branch', { required: 'Branch is required' })}
                className="input-field"
                placeholder="Branch name (auto-filled from IFSC)"
                readOnly={!!bankDetails}
              />
              {errors.branch && (
                <p className="text-red-500 text-sm mt-1">{errors.branch.message}</p>
              )}
            </div>

            {/* Account Type */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Account Type <span className="text-red-500">*</span>
              </label>
              <select
                {...register('accountType', { required: 'Account type is required' })}
                className="input-field"
              >
                <option value="savings">Savings</option>
                <option value="current">Current</option>
              </select>
            </div>

            {/* UPI ID (Optional) */}
            <div>
              <label className="block text-sm font-medium mb-2">
                UPI ID <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <input
                type="text"
                {...register('upiId', {
                  validate: (value) => {
                    if (!value) return true // Optional
                    return validateUPI(value) || 'Invalid UPI ID format (e.g., name@bank)'
                  }
                })}
                className="input-field"
                placeholder="yourname@bank"
              />
              {errors.upiId && (
                <p className="text-red-500 text-sm mt-1">{errors.upiId.message}</p>
              )}
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full btn-primary"
            >
              {loading ? 'Saving...' : 'Save & Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

