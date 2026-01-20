import { useCollection } from '../../hooks/useFirestore'
import { formatCurrency } from '../../utils/helpers'
import { Check, ShoppingCart, Loader2, Package, Star, Sparkles } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import { doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { initiateRazorpayPayment } from '../../utils/razorpayPayment'
import { useState } from 'react'

export default function UserPackages() {
  const { data: packages, loading, error } = useCollection('packages', [])
  const { user, userData } = useAuth()
  const [processingPackage, setProcessingPackage] = useState(null)

  const handleActivate = async (pkg) => {
    if (!user || !user.uid) {
      toast.error('Please login to activate packages')
      return
    }

    if (!userData) {
      toast.error('User data not loaded. Please wait a moment and try again.')
      return
    }

    const userId = user.uid

    setProcessingPackage(pkg.id)

    try {
      // Create a pending user package record first
      const userPackageId = `${userId}_${pkg.id}_${Date.now()}`
      const userPackageRef = doc(db, 'userPackages', userPackageId)
      
      await setDoc(userPackageRef, {
        userId: userId,
        packageId: pkg.id,
        packageName: pkg.name,
        amount: pkg.inrPrice || pkg.usdPrice, // Use INR price for Razorpay
        currency: 'INR',
        status: 'pending',
        createdAt: serverTimestamp(),
        paymentMethod: 'razorpay',
      })

      // Get user contact number (if available)
      const contact = userData.phone || userData.phoneNumber || ''

      // Initiate Razorpay payment
      await initiateRazorpayPayment({
        amount: pkg.inrPrice || pkg.usdPrice,
        currency: 'INR',
        name: userData.name || userData.displayName || 'User',
        email: userData.email,
        contact: contact,
        description: `Payment for ${pkg.name} package`,
        metadata: {
          userId: userId,
          packageId: pkg.id,
          userPackageId: userPackageId,
        },
        onSuccess: async (paymentResponse) => {
          try {
            // Update user package with payment details
            await updateDoc(userPackageRef, {
              status: 'active',
              paymentId: paymentResponse.razorpay_payment_id,
              orderId: paymentResponse.razorpay_order_id,
              signature: paymentResponse.razorpay_signature,
              activatedAt: serverTimestamp(),
              paymentCompleted: true,
            })

            // Create transaction record
            const transactionId = `txn_${Date.now()}`
            await setDoc(doc(db, 'transactions', transactionId), {
              userId: userId,
              userPackageId: userPackageId,
              packageId: pkg.id,
              packageName: pkg.name,
              amount: pkg.inrPrice || pkg.usdPrice,
              currency: 'INR',
              type: 'package_purchase',
              status: 'completed',
              paymentId: paymentResponse.razorpay_payment_id,
              paymentMethod: 'razorpay',
              createdAt: serverTimestamp(),
            })

            toast.success('Package activated successfully!')
            setProcessingPackage(null)
          } catch (error) {
            console.error('Error updating package after payment:', error)
            toast.error('Payment successful but error updating package. Please contact support.')
            setProcessingPackage(null)
          }
        },
        onFailure: async (error) => {
          try {
            // Update user package status to failed
            await updateDoc(userPackageRef, {
              status: 'failed',
              paymentError: error.message,
              paymentFailedAt: serverTimestamp(),
            })
            toast.error(error.message || 'Payment failed. Please try again.')
            setProcessingPackage(null)
          } catch (updateError) {
            console.error('Error updating failed payment:', updateError)
            setProcessingPackage(null)
          }
        },
      })
    } catch (error) {
      console.error('Error initiating payment:', error)
      toast.error('Error initiating payment: ' + (error.message || 'Unknown error'))
      setProcessingPackage(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Investment Packages
          </h1>
          <p className="text-gray-400">Choose your investment plan</p>
        </div>
        <div className="card border-red-500/50">
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">Error loading packages: {error.message || 'Unknown error'}</p>
            <p className="text-gray-400 text-sm">Please check your Firebase connection and Firestore rules.</p>
          </div>
        </div>
      </div>
    )
  }

  // Filter packages by visibility (if set)
  const visiblePackages = packages.filter(pkg => {
    // If no visibility field, show it (backward compatibility)
    if (!pkg.visibility) return true
    // Show public packages
    if (pkg.visibility === 'public') return true
    // Show logged-in packages if user is authenticated
    if (pkg.visibility === 'logged-in' && userData) return true
    // Hide everything else
    return false
  })

  const sortedPackages = [...visiblePackages].sort((a, b) => (a.order || 0) - (b.order || 0))

  if (visiblePackages.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Investment Packages
          </h1>
          <p className="text-gray-400">Choose your investment plan</p>
        </div>
        <div className="card">
          <div className="text-center py-12">
            <ShoppingCart className="text-gray-400 mx-auto mb-4" size={48} />
            <p className="text-gray-400 text-lg mb-2">No packages available</p>
            <p className="text-gray-500 text-sm">
              Packages will appear here once they are added by the admin.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
          Investment Packages
        </h1>
        <p className="text-gray-400">Choose the perfect plan to start your investment journey</p>
      </div>

      {/* Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedPackages.map((pkg) => (
          <div
            key={pkg.id}
            className={`card relative transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 transform hover:-translate-y-2 ${
              pkg.highlight 
                ? 'border-2 border-primary bg-gradient-to-br from-primary/10 to-transparent' 
                : 'hover:border-primary'
            }`}
          >
            {pkg.badge && (
              <div className="absolute -top-4 right-4 bg-primary text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg flex items-center gap-1">
                <Star size={14} className="fill-white" />
                {pkg.badge}
              </div>
            )}
            
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Package className="text-primary" size={24} />
                </div>
                <h3 className="text-2xl font-bold text-white">{pkg.name}</h3>
              </div>
              
              <div className="mb-4">
                <p className="text-4xl font-bold text-primary mb-1">
                  {formatCurrency(pkg.usdPrice, 'USD')}
                </p>
                <p className="text-gray-400 text-sm">
                  {formatCurrency(pkg.inrPrice, 'INR')}
                </p>
              </div>
            </div>
            
            {pkg.features && pkg.features.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3 text-sm text-gray-400">
                  <Sparkles size={16} className="text-primary" />
                  <span className="font-semibold">Package Features</span>
                </div>
                <ul className="space-y-2.5">
                  {pkg.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
                      <Check size={18} className="text-primary flex-shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <button
              onClick={() => handleActivate(pkg)}
              disabled={processingPackage === pkg.id}
              className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed py-3 font-semibold hover:bg-primary/90 transition-all"
            >
              {processingPackage === pkg.id ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ShoppingCart size={20} />
                  Activate Package
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
