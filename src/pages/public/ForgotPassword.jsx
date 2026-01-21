import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { sendPasswordResetEmail } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../config/firebase'
import { validateEmail } from '../../utils/validation'
import toast from 'react-hot-toast'
import { Mail, ArrowLeft, CheckCircle, Loader2, Hash } from 'lucide-react'

export default function ForgotPassword() {
  const [emailSent, setEmailSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors }, watch } = useForm()
  
  const identifier = watch('identifier')

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      let email = data.identifier

      // Check if identifier is a User ID (starts with MTN) or email
      if (!data.identifier.includes('@') && data.identifier.toUpperCase().startsWith('MTN')) {
        // Normalize User ID
        const userId = data.identifier.trim().toUpperCase()
        
        // Lookup User ID in index to get email
        const indexDoc = await getDoc(doc(db, 'userIdIndex', userId))
        if (!indexDoc.exists()) {
          // Don't reveal if User ID exists or not for security
          toast.error('If an account exists with this User ID, a password reset link has been sent.')
          setLoading(false)
          return
        }
        
        const indexData = indexDoc.data()
        email = indexData.email
        
        if (!email) {
          // Fallback: try to get from user document if email not in index
          const uid = indexData.uid
          if (uid) {
            try {
              const userDoc = await getDoc(doc(db, 'users', uid))
              if (userDoc.exists()) {
                email = userDoc.data().email
              }
            } catch (error) {
              console.error('Error fetching user email:', error)
            }
          }
        }
        
        if (!email) {
          toast.error('If an account exists with this User ID, a password reset link has been sent.')
          setLoading(false)
          return
        }
      } else {
        // Validate email format
        const emailError = validateEmail(data.identifier)
        if (emailError) {
          toast.error(emailError)
          setLoading(false)
          return
        }
        email = data.identifier.toLowerCase().trim()
      }

      // Send password reset email
      // Try with custom URL first
      try {
        await sendPasswordResetEmail(auth, email, {
          url: `${window.location.origin}/reset-password`,
          handleCodeInApp: true
        })
        setEmailSent(true)
        toast.success('Password reset email sent! Please check your inbox.')
      } catch (urlError) {
        // If domain not allowlisted, try without custom URL (uses Firebase default)
        if (urlError.code === 'auth/unauthorized-continue-uri') {
          console.warn('Custom URL not allowlisted, using default Firebase URL')
          // Retry without custom URL - Firebase will use its default redirect
          await sendPasswordResetEmail(auth, email)
          setEmailSent(true)
          toast.success('Password reset email sent! Please check your inbox and click the link to reset your password.')
        } else {
          throw urlError // Re-throw if it's a different error
        }
      }
    } catch (error) {
      console.error('Password reset error:', error)
      // Don't reveal if email exists or not for security
      if (error.code === 'auth/user-not-found') {
        toast.error('If an account exists with this email/User ID, a password reset link has been sent.')
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Invalid email address or User ID')
      } else if (error.code === 'auth/unauthorized-continue-uri') {
        toast.error('Domain configuration error. Please contact support.')
      } else {
        toast.error('Error sending password reset email. Please try again.')
      }
    } finally {
      setLoading(false)
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

        {/* Card */}
        <div className="bg-dark-light rounded-lg p-8 border border-gray-800">
          {!emailSent ? (
            <>
              <div className="text-center mb-6">
                <div className="p-3 bg-primary/10 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <Mail className="text-primary" size={32} />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Forgot Password?</h1>
                <p className="text-gray-400 text-sm">
                  Enter your email address or User ID and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">
                    Email Address or User ID <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    {identifier && identifier.toUpperCase().startsWith('MTN') ? (
                      <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    ) : (
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    )}
                    <input
                      type="text"
                      {...register('identifier', { 
                        required: 'Email or User ID is required',
                        validate: (value) => {
                          if (!value) return 'Email or User ID is required'
                          // Accept email or User ID (MTNxxxxxx)
                          if (value.includes('@')) {
                            return validateEmail(value) || true
                          } else if (value.toUpperCase().startsWith('MTN')) {
                            return true
                          }
                          return 'Please enter a valid email address or User ID (MTNxxxxxx)'
                        }
                      })}
                      className="w-full pl-11 pr-4 py-3 bg-white text-black rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                      placeholder="Enter your email or User ID (e.g., MTN329815)"
                      onChange={(e) => {
                        const value = e.target.value
                        // Auto-uppercase User IDs
                        if (value.toUpperCase().startsWith('MTN')) {
                          e.target.value = value.toUpperCase()
                        }
                      }}
                    />
                  </div>
                  {errors.identifier && (
                    <p className="text-red-500 text-sm mt-1">{errors.identifier.message}</p>
                  )}
                  <p className="text-gray-400 text-xs mt-1">
                    You can use either your email address or User ID (MTNxxxxxx)
                  </p>
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-lg font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail size={20} />
                      Send Reset Link
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
            </>
          ) : (
            <div className="text-center">
              <div className="p-3 bg-green-500/10 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <CheckCircle className="text-green-500" size={32} />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Check Your Email</h1>
              <p className="text-gray-400 text-sm mb-6">
                We've sent a password reset link to your email address. Please check your inbox and click the link to reset your password.
              </p>
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20 mb-6">
                <p className="text-sm text-gray-300">
                  <strong className="text-white">Note:</strong> The link will expire in 1 hour. If you don't see the email, check your spam folder.
                </p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => setEmailSent(false)}
                  className="w-full py-3 px-4 rounded-lg font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 transition-all shadow-lg"
                >
                  Resend Email
                </button>
                <Link 
                  to="/auth" 
                  className="block text-white text-sm hover:underline flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={16} />
                  Back to Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

