import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { getRefCodeFromUrl } from '../../utils/helpers'
import { validateName, validateEmail, validatePhone, validatePassword, validateConfirmPassword, validateReferralCode } from '../../utils/validation'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { Eye, EyeOff } from 'lucide-react'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const { signIn, signUp, signInWithGoogle, user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [validatingRefCode, setValidatingRefCode] = useState(false)
  const [refCodeValid, setRefCodeValid] = useState(null)
  const [refCodeError, setRefCodeError] = useState('')
  
  const urlRefCode = searchParams.get('ref') || getRefCodeFromUrl()
  const [refCode, setRefCode] = useState(urlRefCode || '')

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm({
    defaultValues: {
      referralCode: urlRefCode || ''
    }
  })
  
  const password = watch('password')

  useEffect(() => {
    if (user) {
      if (isAdmin) {
        navigate('/admin/dashboard')
      } else {
        navigate('/app/dashboard')
      }
    }
  }, [user, navigate, isAdmin])

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
        // Navigation handled by useEffect
      } else {
        // Validate all fields
        const nameError = validateName(data.name)
        const emailError = validateEmail(data.email)
        const phoneError = validatePhone(data.phone)
        const passwordError = validatePassword(data.password, {
          minLength: 8,
          requireUppercase: true,
          requireNumber: true
        })
        const confirmPasswordError = validateConfirmPassword(data.password, data.confirmPassword)
        
        if (nameError || emailError || phoneError || passwordError || confirmPasswordError) {
          if (nameError) toast.error(nameError)
          if (emailError) toast.error(emailError)
          if (phoneError) toast.error(phoneError)
          if (passwordError) toast.error(passwordError)
          if (confirmPasswordError) toast.error(confirmPasswordError)
          return
        }
        
        // Referral code is optional - only validate if provided
        if (data.referralCode && data.referralCode.trim().length >= 4 && refCodeValid === false) {
          toast.error('Please enter a valid referral code or leave it empty')
          return
        }
        
        const result = await signUp(data.email, data.password, data.name, data.phone, data.referralCode || null)
        toast.success('Account created! Please check your email for verification.')
        
        // Show User ID if available
        if (result && result.userId) {
          setTimeout(() => {
            toast.success(`Your User ID: ${result.userId}`, { duration: 5000 })
          }, 1000)
        }
        
        // Navigation handled by useEffect
      }
    } catch (error) {
      toast.error(error.message || 'An error occurred')
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle()
      toast.success('Logged in successfully')
      navigate('/app/dashboard')
    } catch (error) {
      toast.error(error.message || 'An error occurred')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-16 px-4">
      <div className="max-w-md w-full">
        <div className="card">
          <h1 className="text-3xl font-bold mb-2 text-center">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-gray-400 text-center mb-8">
            {isLogin ? 'Sign in to your account' : 'Join Malaysian Trade Net today'}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('name', { 
                      required: 'Name is required',
                      validate: (value) => validateName(value) || true
                    })}
                    className="input-field"
                    placeholder="Enter your full name"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    {...register('phone', { 
                      required: 'Mobile number is required',
                      validate: (value) => validatePhone(value) || true
                    })}
                    className="input-field"
                    placeholder="10 digit mobile number"
                  />
                  {errors.phone && (
                    <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Referral Code <span className="text-gray-400 text-xs">(Optional)</span>
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
                      className={`input-field ${refCodeValid === false ? 'border-red-500' : refCodeValid === true ? 'border-green-500' : ''}`}
                      placeholder="Enter referral code (optional)"
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
                  {errors.referralCode && (
                    <p className="text-red-500 text-sm mt-1">{errors.referralCode.message}</p>
                  )}
                  {urlRefCode && (
                    <p className="text-gray-400 text-sm mt-1">Referral code from link</p>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                {isLogin ? 'Email or User ID' : 'Email'}
              </label>
              <input
                type={isLogin ? 'text' : 'email'}
                {...register('email', { 
                  required: isLogin ? 'Email or User ID is required' : 'Email is required',
                  validate: (value) => {
                    if (isLogin) {
                      // For login, accept email or User ID
                      if (value.includes('@')) {
                        return validateEmail(value) || true
                      } else if (value.toUpperCase().startsWith('MTN')) {
                        return true
                      }
                      return 'Please enter a valid email or User ID (MTNxxxxxx)'
                    } else {
                      // For signup, only accept email
                      return validateEmail(value) || true
                    }
                  }
                })}
                className="input-field"
                placeholder={isLogin ? "Enter your email or User ID (MTNxxxxxx)" : "Enter your email"}
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', { 
                    required: 'Password is required',
                    validate: (value) => validatePassword(value, {
                      minLength: 8,
                      requireUppercase: true,
                      requireNumber: true
                    }) || true
                  })}
                  className="input-field pr-10"
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
                <label className="block text-sm font-medium mb-2">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    {...register('confirmPassword', { 
                      required: 'Please confirm your password',
                      validate: (value) => validateConfirmPassword(password, value) || true
                    })}
                    className="input-field pr-10"
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

            <button type="submit" className="w-full btn-primary">
              {isLogin ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-dark-light text-gray-400">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              className="mt-4 w-full btn-secondary flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

