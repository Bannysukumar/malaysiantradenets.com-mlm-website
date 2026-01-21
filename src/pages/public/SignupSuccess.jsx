import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { Copy, Check, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SignupSuccess() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, userData } = useAuth()
  const [credentials, setCredentials] = useState(null)
  const [copied, setCopied] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pageLoaded, setPageLoaded] = useState(false)

  // Prevent navigation loops - if user is already authenticated and has completed setup, redirect away
  useEffect(() => {
    // Only redirect if user is authenticated, has userData, and has completed bank details
    // AND we don't have URL params (meaning they're coming back to this page, not from signup)
    // AND we have credentials loaded (to prevent redirecting during initial load)
    const hasUrlParams = searchParams.get('userId') && searchParams.get('password') && searchParams.get('transactionPassword')
    
    // Don't redirect if:
    // 1. We have URL params (fresh signup)
    // 2. We're still loading credentials
    // 3. We don't have credentials yet
    if (hasUrlParams || loading || !credentials) {
      return
    }
    
    // Only redirect if user has already seen this page and completed setup
    if (user && userData && userData.bankDetailsCompleted) {
      // User has already completed signup and is coming back to this page - redirect to dashboard
      navigate('/app/dashboard', { replace: true })
      return
    }
  }, [user, userData, navigate, searchParams, loading, credentials])

  // Auto-refresh only if page doesn't load within 3 seconds AND we don't have credentials yet
  useEffect(() => {
    // Only set up auto-refresh if we're still loading and don't have credentials
    if (credentials || pageLoaded) {
      return // Don't auto-refresh if we already have credentials or page is loaded
    }

    const loadTimer = setTimeout(() => {
      if (!pageLoaded && !credentials) {
        // Page hasn't loaded properly and no credentials, refresh
        window.location.reload()
      }
    }, 3000)

    return () => clearTimeout(loadTimer)
  }, [pageLoaded, credentials])

  useEffect(() => {
    let isMounted = true
    let checkInterval = null

    const loadCredentials = async () => {
      try {
        // Priority 1: Get credentials from URL params (most reliable after signup)
        const userIdFromParams = searchParams.get('userId')
        const passwordFromParams = searchParams.get('password')
        const transactionPasswordFromParams = searchParams.get('transactionPassword')
        const userNameFromParams = searchParams.get('name')

        // If we have all required params from URL, use them immediately (no waiting)
        if (userIdFromParams && passwordFromParams && transactionPasswordFromParams) {
          if (isMounted) {
            setCredentials({
              userId: userIdFromParams,
              password: passwordFromParams,
              transactionPassword: transactionPasswordFromParams,
              userName: userNameFromParams || 'User'
            })
            setLoading(false)
            setPageLoaded(true) // Mark page as loaded to prevent auto-refresh
          }
          return
        }

        // Priority 2: Try to get from userData if available
        if (userData?.userId && userData?.transactionPassword) {
          if (isMounted) {
            setCredentials({
              userId: userData.userId,
              password: passwordFromParams || 'Your signup password',
              transactionPassword: userData.transactionPassword,
              userName: userData.name || userNameFromParams || 'User'
            })
            setLoading(false)
            setPageLoaded(true) // Mark page as loaded
          }
          return
        }

        // Priority 3: Fetch from Firestore if user is authenticated
        if (user?.uid) {
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          if (userDoc.exists() && isMounted) {
            const data = userDoc.data()
            if (data.userId && data.transactionPassword) {
              setCredentials({
                userId: data.userId,
                password: passwordFromParams || 'Your signup password',
                transactionPassword: data.transactionPassword,
                userName: data.name || userNameFromParams || 'User'
              })
              setLoading(false)
              setPageLoaded(true) // Mark page as loaded
              return
            }
          }
        }

        // If still no credentials, set loading to false (will show fallback UI)
        // The component will re-run this effect when user/userData updates
        if (isMounted) {
          setLoading(false)
          setPageLoaded(true) // Mark as loaded even if no credentials (will show fallback)
        }
      } catch (error) {
        console.error('Error loading credentials:', error)
        if (isMounted) {
          toast.error('Error loading account information')
          setLoading(false)
          setPageLoaded(true) // Mark as loaded even on error to prevent auto-refresh
        }
      }
    }

    loadCredentials()

    // Cleanup function
    return () => {
      isMounted = false
      if (checkInterval) {
        clearInterval(checkInterval)
      }
    }
  }, [user, userData, searchParams])

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text)
    setCopied(type)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopied(null), 2000)
  }

  const handleContinue = () => {
    // Navigate to profile to add bank details or dashboard
    if (!userData?.bankDetailsCompleted) {
      navigate('/app/profile')
    } else {
      navigate('/app/dashboard')
    }
  }

  // Show loading only if we don't have URL params (which means we're waiting for auth state)
  const hasUrlParams = searchParams.get('userId') && searchParams.get('password') && searchParams.get('transactionPassword')
  
  if (loading && !hasUrlParams) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!credentials) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Unable to load account information.</p>
          <button
            onClick={() => navigate('/app/dashboard')}
            className="btn-primary"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Generate referral link with reffer parameter (matching image format)
  const baseUrl = window.location.origin
  const referralLink = `${baseUrl}/auth?reffer=${credentials.userId}`

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="bg-black rounded-lg p-6 w-full max-w-xs border-2 border-yellow-400">
            <div className="flex items-center justify-center">
              <img 
                src="https://malaysiantrade.net/assets/logo-DRFcCaVQ.png" 
                alt="Malaysian Trade Net Logo" 
                className="h-auto w-full object-contain"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Greeting */}
          <div className="text-gray-600 text-center">
            <p className="text-lg">Dear {credentials.userName || 'User'}</p>
          </div>

          {/* Welcome Message */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Congratulations on joining MalaysianTrade
            </h1>
            <p className="text-gray-600">We are in the prelaunch phase.</p>
          </div>

          {/* Credentials */}
          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Your Username :</p>
              <div className="flex items-center justify-between bg-white rounded p-3 border">
                <span className="font-mono font-semibold text-gray-900">{credentials.userId}</span>
                <button
                  onClick={() => handleCopy(credentials.userId, 'userId')}
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  {copied === 'userId' ? (
                    <Check size={18} className="text-green-500" />
                  ) : (
                    <Copy size={18} />
                  )}
                </button>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">Your Password :</p>
              <div className="flex items-center justify-between bg-white rounded p-3 border">
                <span className="font-mono font-semibold text-gray-900">{credentials.password}</span>
                <button
                  onClick={() => handleCopy(credentials.password, 'password')}
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  {copied === 'password' ? (
                    <Check size={18} className="text-green-500" />
                  ) : (
                    <Copy size={18} />
                  )}
                </button>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">Your Transaction Password :</p>
              <div className="flex items-center justify-between bg-white rounded p-3 border">
                <span className="font-mono font-semibold text-gray-900">{credentials.transactionPassword}</span>
                <button
                  onClick={() => handleCopy(credentials.transactionPassword, 'transactionPassword')}
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  {copied === 'transactionPassword' ? (
                    <Check size={18} className="text-green-500" />
                  ) : (
                    <Copy size={18} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Referral Section */}
          <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
            <p className="text-gray-700 mb-3 text-center">
              Join your friends and relatives and make them wealthy with MalaysianTrade products and services.
            </p>
            <p className="text-sm text-gray-600 mb-3 text-center">
              Use the following link to refer new members.
            </p>
            <div className="bg-white rounded p-3 border border-yellow-300">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gray-600 break-all flex-1">{referralLink}</p>
                <button
                  onClick={() => handleCopy(referralLink, 'referral')}
                  className="text-primary hover:text-primary/80 transition-colors flex-shrink-0"
                >
                  {copied === 'referral' ? (
                    <Check size={18} className="text-green-500" />
                  ) : (
                    <Copy size={18} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            className="w-full bg-primary text-white py-4 rounded-lg font-semibold text-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            Continue
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

