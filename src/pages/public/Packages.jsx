import { useCollection } from '../../hooks/useFirestore'
import { formatCurrency } from '../../utils/helpers'
import { useAuth } from '../../contexts/AuthContext'
import { Link } from 'react-router-dom'
import { Check, Star, TrendingUp } from 'lucide-react'

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
    <div className="min-h-screen py-16 px-4 relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-15"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80)'
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-b from-dark/95 via-dark-light/90 to-dark/95"></div>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Our Investment Packages
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
            Choose the Perfect Plan to Start Your Investment Journey
          </p>
        </div>

        {sortedPackages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">No packages available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {sortedPackages.map((pkg) => (
              <div
                key={pkg.id}
                className={`group relative card transition-all duration-300 ${
                  pkg.highlight 
                    ? 'border-2 border-primary bg-gradient-to-br from-primary/10 to-transparent transform scale-105' 
                    : 'hover:border-primary hover:shadow-xl hover:shadow-primary/10'
                } hover:-translate-y-2`}
              >
                {pkg.badge && (
                  <div className="absolute -top-4 right-4 bg-primary text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg flex items-center gap-1">
                    <Star size={14} className="fill-white" />
                    {pkg.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-primary transition-colors">
                    {pkg.name}
                  </h3>
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
                      <TrendingUp size={16} className="text-primary" />
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

                <div className="mt-auto pt-4 border-t border-gray-800">
                  {user ? (
                    <Link
                      to="/app/packages"
                      className="block w-full btn-primary text-center py-3 font-semibold hover:bg-primary/90 transition-colors"
                    >
                      Activate Package
                    </Link>
                  ) : (
                    <Link
                      to="/auth"
                      className="block w-full btn-primary text-center py-3 font-semibold hover:bg-primary/90 transition-colors"
                    >
                      Get Started
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Additional Info */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card text-center">
            <div className="text-3xl font-bold text-primary mb-2">100%</div>
            <div className="text-gray-400">ROI Potential</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-primary mb-2">Weekly</div>
            <div className="text-gray-400">Payouts</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-primary mb-2">24/7</div>
            <div className="text-gray-400">Support</div>
          </div>
        </div>
      </div>
    </div>
  )
}
