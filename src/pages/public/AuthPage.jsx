import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { getRefCodeFromUrl } from '../../utils/helpers'
import { validateName, validateEmail, validatePhone, validatePassword, validateConfirmPassword, validatePAN, validateIFSC, validateAccountNumber } from '../../utils/validation'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { Eye, EyeOff, Mail } from 'lucide-react'
import { countries, indianStates, bankNames } from '../../utils/countriesStates'
import { fetchIFSCDetails } from '../../utils/ifscApi'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const { signIn, signUp, user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [validatingRefCode, setValidatingRefCode] = useState(false)
  const [refCodeValid, setRefCodeValid] = useState(null)
  const [refCodeError, setRefCodeError] = useState('')
  const [countryCode, setCountryCode] = useState('+91')
  const [fetchingIFSC, setFetchingIFSC] = useState(false)
  const [bankDetails, setBankDetails] = useState(null)
  
  // Support both 'ref' and 'reffer' parameters for backward compatibility
  const urlRefCode = searchParams.get('ref') || searchParams.get('reffer') || getRefCodeFromUrl()
  const [refCode, setRefCode] = useState(urlRefCode || '')

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm({
    defaultValues: {
      referralCode: urlRefCode || '',
      countryCode: '+91',
      country: '',
      state: '',
      panCard: '',
      accountNumber: '',
      bankName: '',
      branchName: '',
      ifscCode: ''
    }
  })
  
  const password = watch('password')
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
        setValue('branchName', details.branch || '')
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

  // Only redirect authenticated users away from auth page (not from signup-success)
  // This prevents skipping the signup success page
  useEffect(() => {
    // Only redirect if user is authenticated AND they're on the /auth page
    // Don't redirect if they're on signup-success or other pages
    if (user && location.pathname === '/auth') {
      if (isAdmin) {
        navigate('/admin/dashboard')
      } else {
        navigate('/app/dashboard')
      }
    }
  }, [user, navigate, isAdmin, location.pathname])

  // Validate referral code when it changes
  useEffect(() => {
    if (!isLogin && refCode && refCode.trim().length >= 4) {
      validateReferralCodeExists(refCode)
    } else if (!isLogin && refCode && refCode.trim().length > 0 && refCode.trim().length < 4) {
      setRefCodeValid(false)
      setRefCodeError('Referral code must be at least 4 characters')
    } else if (!isLogin && !refCode) {
      setRefCodeValid(null)
      setRefCodeError('')
    }
  }, [refCode, isLogin])

  const validateReferralCodeExists = async (code) => {
    if (!code || code.trim().length < 4) {
      setRefCodeValid(false)
      setRefCodeError('Invalid referral code')
      return
    }

    setValidatingRefCode(true)
    setRefCodeError('')
    
    try {
      const functions = getFunctions()
      const validateReferralCode = httpsCallable(functions, 'validateReferralCode')
      const result = await validateReferralCode({ refCode: code })
      
      const { valid, error } = result.data
      
      if (valid) {
        setRefCodeValid(true)
        setRefCodeError('')
      } else {
        setRefCodeValid(false)
        setRefCodeError(error || 'Invalid referral code')
      }
    } catch (error) {
      console.error('Error validating referral code:', error)
      setRefCodeValid(false)
      setRefCodeError('Error validating referral code')
    } finally {
      setValidatingRefCode(false)
    }
  }

  const onSubmit = async (data) => {
    try {
      if (isLogin) {
        await signIn(data.email, data.password)
        toast.success('Logged in successfully')
      } else {
        // Validate all fields
        const nameError = validateName(data.name)
        const emailError = validateEmail(data.email)
        const phoneError = validatePhone(data.phone)
        const panError = validatePAN(data.panCard)
        const passwordError = validatePassword(data.password, {
          minLength: 8,
          requireUppercase: true,
          requireNumber: true
        })
        const confirmPasswordError = validateConfirmPassword(data.password, data.confirmPassword)
        const accountNumberError = validateAccountNumber(data.accountNumber)
        const ifscError = validateIFSC(data.ifscCode)
        
        if (nameError || emailError || phoneError || panError || passwordError || confirmPasswordError || accountNumberError || ifscError) {
          if (nameError) toast.error(nameError)
          if (emailError) toast.error(emailError)
          if (phoneError) toast.error(phoneError)
          if (panError) toast.error(panError)
          if (passwordError) toast.error(passwordError)
          if (confirmPasswordError) toast.error(confirmPasswordError)
          if (accountNumberError) toast.error(accountNumberError)
          if (ifscError) toast.error(ifscError)
          return
        }
        
        if (!data.country) {
          toast.error('Please select a country')
          return
        }
        
        if (!data.state) {
          toast.error('Please select a state')
          return
        }
        
        if (!data.bankName) {
          toast.error('Please select a bank name')
          return
        }
        
        if (!data.branchName) {
          toast.error('Please enter branch name')
          return
        }
        
        // Referral code is optional - only validate if provided
        if (data.referralCode && data.referralCode.trim().length >= 4 && refCodeValid === false) {
          toast.error('Please enter a valid referral code or leave it empty')
          return
        }
        
        // Prepare signup data with all fields
        const signupData = {
          email: data.email,
          password: data.password,
          name: data.name,
          phone: `${data.countryCode}${data.phone}`,
          panCard: data.panCard.toUpperCase(),
          country: data.country,
          state: data.state,
          referralCode: data.referralCode || null,
          bankDetails: {
            accountNumber: data.accountNumber,
            bankName: data.bankName,
            branchName: data.branchName,
            ifscCode: data.ifscCode.toUpperCase()
          }
        }
        
        const result = await signUp(signupData)
        
        // Navigate to success page with credentials
        let userId = result?.userId
        let password = result?.password
        let transactionPassword = result?.transactionPassword
        let userName = result?.name || data.name
        
        // If User ID not immediately available, wait for it
        if (!userId && result?.user) {
          try {
            // Wait a bit for userId to be generated by Cloud Function
            await new Promise(resolve => setTimeout(resolve, 2000))
            const userDoc = await getDoc(doc(db, 'users', result.user.uid))
            if (userDoc.exists()) {
              const userData = userDoc.data()
              userId = userData.userId
              transactionPassword = userData.transactionPassword || transactionPassword
            }
          } catch (error) {
            console.warn('Could not fetch userId:', error)
          }
        }
        
        // Navigate to success page with credentials in URL params
        if (userId && password && transactionPassword) {
          navigate(`/signup-success?userId=${encodeURIComponent(userId)}&password=${encodeURIComponent(password)}&transactionPassword=${encodeURIComponent(transactionPassword)}&name=${encodeURIComponent(userName)}`)
        } else {
          // Fallback: navigate anyway, page will try to load from user data
          navigate('/signup-success')
        }
      }
    } catch (error) {
      toast.error(error.message || 'An error occurred')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black py-16 px-4 relative overflow-hidden">
      {/* Red glow effect around edges */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-red-500/10 via-transparent to-red-500/10 blur-3xl"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Logo and Title */}
        <div className="flex items-center gap-4 mb-8 justify-center">
          <div className="w-16 h-16 bg-black rounded-full border-2 border-white flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img 
              src="https://malaysiantrade.net/assets/logo-DRFcCaVQ.png" 
              alt="MTN Logo" 
              className="w-full h-full object-contain p-2"
            />
          </div>
          <div className="text-left">
            <div className="text-white text-sm font-semibold leading-tight">MALAYSIAN</div>
            <div className="text-white text-sm font-semibold leading-tight">TRADE NET</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-dark-light rounded-t-lg p-1 mb-0 border-b border-gray-800">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
              isLogin
                ? 'bg-white text-black'
                : 'text-white hover:text-gray-300'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
              !isLogin
                ? 'bg-white text-black'
                : 'text-white hover:text-gray-300'
            }`}
          >
            Register
          </button>
        </div>

        {/* Form Card */}
        <div className="bg-dark-light rounded-b-lg p-8 border border-gray-800">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {!isLogin && (
              <>
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('name', { 
                      required: 'Name is required',
                      validate: (value) => validateName(value) || true
                    })}
                    className="w-full px-4 py-3 bg-dark-lighter text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter your full name"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                  )}
                </div>

                {/* Mobile Number with Country Code */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      {...register('countryCode')}
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="px-4 py-3 bg-dark-lighter text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {countries.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.flag} {country.code}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      {...register('phone', { 
                        required: 'Mobile number is required',
                        validate: (value) => validatePhone(value) || true
                      })}
                      className="flex-1 px-4 py-3 bg-dark-lighter text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Enter phone number"
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>
                  )}
                </div>

                {/* PAN Card */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">
                    PAN Card <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('panCard', { 
                      required: 'PAN card is required',
                      validate: (value) => validatePAN(value) || true,
                      onChange: (e) => {
                        const upper = e.target.value.toUpperCase().trim()
                        setValue('panCard', upper)
                      }
                    })}
                    className="w-full px-4 py-3 bg-dark-lighter text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                    placeholder="ABCDE1234F"
                    maxLength={10}
                  />
                  {errors.panCard && (
                    <p className="text-red-500 text-sm mt-1">{errors.panCard.message}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">
                    Email ID <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      {...register('email', { 
                        required: 'Email is required',
                        validate: (value) => validateEmail(value) || true
                      })}
                      className="w-full px-4 py-3 pr-10 bg-dark-lighter text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="email@example.com"
                    />
                    <Mail className="absolute right-3 top-3.5 text-gray-400" size={18} />
                  </div>
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                  )}
                </div>

                {/* Country */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('country', { required: 'Country is required' })}
                    className="w-full px-4 py-3 bg-dark-lighter text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">SelectOne</option>
                    {countries.map((country) => (
                      <option key={country.code} value={country.name}>
                        {country.flag} {country.name}
                      </option>
                    ))}
                  </select>
                  {errors.country && (
                    <p className="text-red-500 text-sm mt-1">{errors.country.message}</p>
                  )}
                </div>

                {/* State */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">
                    State <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('state', { required: 'State is required' })}
                    className="w-full px-4 py-3 bg-dark-lighter text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">SelectOne</option>
                    {indianStates.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                  {errors.state && (
                    <p className="text-red-500 text-sm mt-1">{errors.state.message}</p>
                  )}
                </div>

                {/* Referred By */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">
                    Referred By <span className="text-gray-400 text-xs">(Optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      {...register('referralCode', { 
                        onChange: (e) => {
                          const code = e.target.value.toUpperCase().trim()
                          setRefCode(code)
                          setValue('referralCode', code)
                          if (code.length >= 4) {
                            validateReferralCodeExists(code)
                          } else if (code.length === 0) {
                            setRefCodeValid(null)
                            setRefCodeError('')
                          }
                        }
                      })}
                      className={`w-full px-4 py-3 bg-dark-lighter text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary ${
                        refCodeValid === false ? 'border-red-500' : refCodeValid === true ? 'border-green-500' : ''
                      }`}
                      placeholder="Referral"
                      disabled={!!urlRefCode}
                    />
                    {validatingRefCode && (
                      <div className="absolute right-3 top-3">
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary"></div>
                      </div>
                    )}
                    {refCodeValid === true && !validatingRefCode && (
                      <div className="absolute right-3 top-3 text-green-500">
                        ✓
                      </div>
                    )}
                    {refCodeValid === false && !validatingRefCode && (
                      <div className="absolute right-3 top-3 text-red-500">
                        ✗
                      </div>
                    )}
                  </div>
                  {refCodeError && (
                    <p className="text-red-500 text-sm mt-1">{refCodeError}</p>
                  )}
                </div>

                {/* Bank Details Section */}
                <div className="pt-4 border-t border-gray-700">
                  <h3 className="text-lg font-bold text-white mb-4">Bank Details</h3>
                  
                  {/* Account Number */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2 text-white">
                      Account Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      {...register('accountNumber', { 
                        required: 'Account number is required',
                        validate: (value) => validateAccountNumber(value) || true
                      })}
                      className="w-full px-4 py-3 bg-dark-lighter text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Account Number"
                    />
                    {errors.accountNumber && (
                      <p className="text-red-500 text-sm mt-1">{errors.accountNumber.message}</p>
                    )}
                  </div>

                   {/* Bank Name - Auto-filled from IFSC */}
                   <div className="mb-4">
                     <label className="block text-sm font-medium mb-2 text-white">
                       Bank Name <span className="text-red-500">*</span>
                     </label>
                     <input
                       type="text"
                       {...register('bankName', { required: 'Bank name is required' })}
                       className="w-full px-4 py-3 bg-dark-lighter text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                       placeholder="Bank name (auto-filled from IFSC or enter manually)"
                     />
                     {errors.bankName && (
                       <p className="text-red-500 text-sm mt-1">{errors.bankName.message}</p>
                     )}
                     <p className="text-gray-400 text-xs mt-1">
                       Enter IFSC code and click Auto-fill to fetch bank name automatically
                     </p>
                   </div>

                  {/* Branch Name */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2 text-white">
                      Branch Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      {...register('branchName', { required: 'Branch name is required' })}
                      className="w-full px-4 py-3 bg-dark-lighter text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Branch"
                      readOnly={!!bankDetails}
                    />
                    {errors.branchName && (
                      <p className="text-red-500 text-sm mt-1">{errors.branchName.message}</p>
                    )}
                  </div>

                  {/* IFSC Code */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">
                      IFSC Code <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        {...register('ifscCode', { 
                          required: 'IFSC code is required',
                          validate: (value) => validateIFSC(value) || true,
                          onChange: (e) => {
                            const upper = e.target.value.toUpperCase().trim().slice(0, 11)
                            setValue('ifscCode', upper)
                          }
                        })}
                        className="flex-1 px-4 py-3 bg-dark-lighter text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                        placeholder="IFSC Code"
                        maxLength={11}
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
                        className="px-4 py-3 bg-dark-lighter text-white rounded-lg border border-gray-700 hover:bg-dark hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {fetchingIFSC ? '...' : 'Auto-fill'}
                      </button>
                    </div>
                    {errors.ifscCode && (
                      <p className="text-red-500 text-sm mt-1">{errors.ifscCode.message}</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {isLogin && (
              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  User ID
                </label>
                <input
                  type="text"
                  {...register('email', { 
                    required: 'User ID is required',
                    validate: (value) => {
                      // For login, accept email or User ID
                      if (value.includes('@')) {
                        return validateEmail(value) || true
                      } else if (value.toUpperCase().startsWith('MTN')) {
                        return true
                      }
                      return 'Please enter a valid email or User ID (MTNxxxxxx)'
                    }
                  })}
                  className="w-full px-4 py-3 bg-dark-lighter text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter your User ID (e.g., MTN329815)"
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2 text-white">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', { 
                    required: 'Password is required',
                    // Only validate password format during signup, not login
                    validate: isLogin ? undefined : (value) => validatePassword(value, {
                      minLength: 8,
                      requireUppercase: true,
                      requireNumber: true
                    }) || true
                  })}
                  className="w-full px-4 py-3 bg-dark-lighter text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
              )}
              {!isLogin && (
                <p className="text-gray-400 text-xs mt-1">
                  Must be at least 8 characters with 1 uppercase and 1 number
                </p>
              )}
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium mb-2 text-white">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    {...register('confirmPassword', { 
                      required: 'Please confirm your password',
                      validate: (value) => validateConfirmPassword(password, value) || true
                    })}
                    className="w-full px-4 py-3 bg-dark-lighter text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary pr-10"
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>
                )}
              </div>
            )}

            <button 
              type="submit" 
              className="w-full py-3 px-4 rounded-lg font-semibold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 transition-all shadow-lg"
            >
              {isLogin ? 'Log In' : 'Register'}
            </button>
          </form>

          {isLogin && (
            <div className="mt-4 text-center">
              <Link to="/forgot-password" className="text-white text-sm hover:underline">
                Forgot Your Password?
              </Link>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-white text-sm hover:underline"
            >
              {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
