import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Shield } from 'lucide-react'

export default function AdminLogin() {
  const { signIn, user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit } = useForm()

  useEffect(() => {
    if (user && isAdmin) {
      navigate('/admin/dashboard')
    }
  }, [user, isAdmin, navigate])

  const onSubmit = async (data) => {
    try {
      await signIn(data.email, data.password)
      // Check if user is admin (will be handled by protected route)
      navigate('/admin/dashboard')
    } catch (error) {
      toast.error('Invalid credentials or insufficient permissions')
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
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                {...register('email', { required: true })}
                className="input-field"
                placeholder="admin@example.com"
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

            <button type="submit" className="w-full btn-primary">
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

