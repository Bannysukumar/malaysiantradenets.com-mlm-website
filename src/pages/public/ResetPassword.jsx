import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { auth } from '../../config/firebase'
import { validatePassword, validateConfirmPassword } from '../../utils/validation'
import toast from 'react-hot-toast'
import { Lock, CheckCircle, XCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [codeValid, setCodeValid] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const oobCode = searchParams.get('oobCode')
  const mode = searchParams.get('mode')

  const { register, handleSubmit, formState: { errors }, watch } = useForm()
  const password = watch('password')

  useEffect(() => {
    const verifyCode = async () => {
      if (!oobCode || mode !== 'resetPassword') {
        setCodeValid(false)
        setVerifying(false)
        return
      }

      try {
        // Verify the password reset code
        await verifyPasswordResetCode(auth, oobCode)
        setCodeValid(true)
      } catch (error) {
        console.error('Code verification error:', error)
        setCodeValid(false)
        if (error.code === 'auth/expired-action-code') {
          toast.error('This password reset link has expired. Please request a new one.')
        } else if (error.code === 'auth/invalid-action-code') {
          toast.error('Invalid password reset link. Please request a new one.')
        } else {
          toast.error('Error verifying reset link. Please try again.')
        }
      } finally {
        setVerifying(false)
      }
    }

    verifyCode()
  }, [oobCode, mode])

  const onSubmit = async (data) => {
    if (!oobCode) {
      toast.error('Invalid reset link')
      return
    }

    // Validate password
    const passwordError = validatePassword(data.password, {
      minLength: 8,
      requireUppercase: true,
      requireNumber: true
    })
    if (passwordError) {
      toast.error(passwordError)
      return
    }

    const confirmPasswordError = validateConfirmPassword(data.password, data.confirmPassword)
    if (confirmPasswordError) {
      toast.error(confirmPasswordError)
      return
    }

    setLoading(true)
    try {
      await confirmPasswordReset(auth, oobCode, data.password)
      toast.success('Password reset successfully! You can now login with your new password.')
      setTimeout(() => {
        navigate('/auth')
      }, 2000)
    } catch (error) {
      console.error('Password reset error:', error)
      if (error.code === 'auth/expired-action-code') {
        toast.error('This password reset link has expired. Please request a new one.')
      } else if (error.code === 'auth/invalid-action-code') {
        toast.error('Invalid password reset link. Please request a new one.')
      } else {
        toast.error('Error resetting password. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black py-16 px-4">
        <div className="max-w-md w-full bg-dark-light rounded-lg p-8 border border-gray-800 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-400">Verifying reset link...</p>
        </div>
      </div>
    )
  }

  if (!codeValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black py-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-red-500/10 via-transparent to-red-500/10 blur-3xl"></div>
        </div>

        <div className="max-w-md w-full relative z-10">
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

          <div className="bg-dark-light rounded-lg p-8 border border-gray-800 text-center">
            <div className="p-3 bg-red-500/10 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <XCircle className="text-red-500" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Invalid Reset Link</h1>
            <p className="text-gray-400 text-sm mb-6">
              This password reset link is invalid or has expired. Please request a new password reset link.
            </p>
            <div className="space-y-3">
              <Link
                to="/forgot-password"
                className="block w-full py-3 px-4 rounded-lg font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 transition-all shadow-lg text-center"
              >
                Request New Reset Link
              </Link>
              <Link 
                to="/auth" 
                className="block text-white text-sm hover:underline flex items-center justify-center gap-2"
              >
                <ArrowLeft size={16} />
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
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

        {/* Card */}
        <div className="bg-dark-light rounded-lg p-8 border border-gray-800">
          <div className="text-center mb-6">
            <div className="p-3 bg-primary/10 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Lock className="text-primary" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Reset Your Password</h1>
            <p className="text-gray-400 text-sm">
              Enter your new password below.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
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
                  className="w-full pl-11 pr-10 py-3 bg-white text-black rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:text-black"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
              )}
              <p className="text-gray-400 text-xs mt-1">
                Must be at least 8 characters with 1 uppercase and 1 number
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  {...register('confirmPassword', { 
                    required: 'Please confirm your password',
                    validate: (value) => validateConfirmPassword(password, value) || true
                  })}
                  className="w-full pl-11 pr-10 py-3 bg-white text-black rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:text-black"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                  Resetting Password...
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  Reset Password
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link 
              to="/auth" 
              className="text-white text-sm hover:underline flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

