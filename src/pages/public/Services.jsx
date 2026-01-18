import { useCollection } from '../../hooks/useFirestore'
import { TrendingUp, Building2, Coins, Bitcoin, BarChart3 } from 'lucide-react'

const defaultServices = [
  { id: '1', name: 'Forex Trading', icon: 'TrendingUp', description: 'Professional forex trading services with expert analysis and market insights.' },
  { id: '2', name: 'Share Market', icon: 'BarChart3', description: 'Stock market investment opportunities with comprehensive market research.' },
  { id: '3', name: 'Real Estate', icon: 'Building2', description: 'Premium real estate investment options with guaranteed returns.' },
  { id: '4', name: 'Gold Mining', icon: 'Coins', description: 'Secure gold mining investments with transparent operations.' },
  { id: '5', name: 'Crypto Mining', icon: 'Bitcoin', description: 'Advanced cryptocurrency mining solutions with high ROI potential.' },
]

const iconMap = {
  TrendingUp,
  BarChart3,
  Building2,
  Coins,
  Bitcoin,
}

export default function Services() {
  const { data: services, loading } = useCollection('services')

  const displayServices = services.length > 0 ? services : defaultServices

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center">Our Services</h1>
        <p className="text-xl text-gray-300 mb-12 text-center">Comprehensive Investment Solutions</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayServices.map((service) => {
            const Icon = iconMap[service.icon] || TrendingUp
            return (
              <div key={service.id} className="card hover:border-primary transition-colors">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-primary/20 rounded-lg">
                    <Icon className="text-primary" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-white">{service.name}</h3>
                </div>
                <p className="text-gray-400">{service.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

