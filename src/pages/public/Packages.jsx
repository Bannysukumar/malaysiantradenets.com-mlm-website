import { useCollection } from '../../hooks/useFirestore'
import { formatCurrency } from '../../utils/helpers'
import { useAuth } from '../../contexts/AuthContext'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'

export default function Packages() {
  const { data: packages, loading } = useCollection('packages', [])
  const { user } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Sort packages by order if available
  const sortedPackages = [...packages].sort((a, b) => (a.order || 0) - (b.order || 0))

  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center">Our Packages</h1>
        <p className="text-xl text-gray-300 mb-12 text-center">Choose Your Investment Plan</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedPackages.map((pkg) => (
            <div
              key={pkg.id}
              className={`card relative ${pkg.highlight ? 'border-2 border-primary' : ''}`}
            >
              {pkg.badge && (
                <div className="absolute -top-3 right-4 bg-primary text-white px-3 py-1 rounded-full text-sm font-bold">
                  {pkg.badge}
                </div>
              )}
              <h3 className="text-2xl font-bold text-white mb-2">{pkg.name}</h3>
              <div className="mb-4">
                <p className="text-3xl font-bold text-primary mb-1">
                  {formatCurrency(pkg.usdPrice, 'USD')}
                </p>
                <p className="text-gray-400">
                  {formatCurrency(pkg.inrPrice, 'INR')}
                </p>
              </div>
              {pkg.features && pkg.features.length > 0 && (
                <ul className="space-y-2 mb-6">
                  {pkg.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check size={16} className="text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
              {user ? (
                <Link
                  to="/app/packages"
                  className="block w-full btn-primary text-center"
                >
                  Activate Package
                </Link>
              ) : (
                <Link
                  to="/auth"
                  className="block w-full btn-primary text-center"
                >
                  Get Started
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

