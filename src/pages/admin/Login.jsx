import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Shield } from 'lucide-react'

export default function AdminLogin() {
  const { signIn, user, isAdmin, loading, userData } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit } = useForm()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loginAttempted, setLoginAttempted] = useState(false)

  // Redirect if already logged in as admin
  useEffect(() => {
    if (!loading && user && isAdmin) {
      setIsSubmitting(false)
      setLoginAttempted(false)
      navigate('/admin/dashboard', { replace: true })
    } else if (!loading && user && userData && !isAdmin && loginAttempted) {
      // If user just logged in but is not admin, show error and redirect
      toast.error('Access denied. Admin privileges required.')
      setIsSubmitting(false)
      setLoginAttempted(false)
      setTimeout(() => {
        navigate('/app/dashboard', { replace: true })
      }, 2000)
    }
  }, [user, isAdmin, loading, navigate, loginAttempted, userData])

  const onSubmit = async (data) => {
    setIsSubmitting(true)
    setLoginAttempted(true)
    try {
      await signIn(data.email, data.password)
      // Wait a moment for userData to load, then check admin status
      // The useEffect will handle navigation once userData is loaded
    } catch (error) {
      console.error('Login error:', error)
      toast.error(error.message || 'Invalid credentials or insufficient permissions')
      setIsSubmitting(false)
      setLoginAttempted(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark px-4">
      <div className="max-w-md w-full">
        <div className="card">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Shield className="text-primary" size={32} />
            <h1 className="text-3xl font-bold">Admin Login</h1>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email or User ID</label>
              <input
                type="text"
                {...register('email', { required: true })}
                className="input-field"
                placeholder="admin@example.com or MTNxxxxxx"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                {...register('password', { required: true })}
                className="input-field"
                placeholder="Enter password"
              />
            </div>

            <button 
              type="submit" 
              className="w-full btn-primary"
              disabled={isSubmitting || loading}
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

