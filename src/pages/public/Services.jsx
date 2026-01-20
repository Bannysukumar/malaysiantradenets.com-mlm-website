import { useCollection } from '../../hooks/useFirestore'
import { TrendingUp, Building2, Coins, Bitcoin, BarChart3, Sparkles } from 'lucide-react'

const defaultServices = [
  { 
    id: '1', 
    name: 'Forex Trading', 
    icon: 'TrendingUp', 
    description: 'Professional forex trading services with expert analysis and market insights. Trade major currency pairs with competitive spreads and advanced trading tools.',
    features: ['Real-time market analysis', 'Expert trading signals', 'Risk management tools', '24/7 market access']
  },
  { 
    id: '2', 
    name: 'Share Market', 
    icon: 'BarChart3', 
    description: 'Stock market investment opportunities with comprehensive market research. Build a diversified portfolio with expert guidance.',
    features: ['Portfolio diversification', 'Market research reports', 'Expert recommendations', 'Long-term growth strategies']
  },
  { 
    id: '3', 
    name: 'Real Estate', 
    icon: 'Building2', 
    description: 'Premium real estate investment options with guaranteed returns. Invest in carefully selected properties with high growth potential.',
    features: ['Property portfolio management', 'Guaranteed returns', 'Regular income streams', 'Capital appreciation']
  },
  { 
    id: '4', 
    name: 'Gold Mining', 
    icon: 'Coins', 
    description: 'Secure gold mining investments with transparent operations. Benefit from the stability and value of precious metals.',
    features: ['Transparent operations', 'Secure storage', 'Regular audits', 'Stable returns']
  },
  { 
    id: '5', 
    name: 'Crypto Mining', 
    icon: 'Bitcoin', 
    description: 'Advanced cryptocurrency mining solutions with high ROI potential. Leverage cutting-edge technology for maximum returns.',
    features: ['Advanced mining technology', 'High ROI potential', 'Multiple cryptocurrencies', 'Automated operations']
  },
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
    <div className="min-h-screen py-16 px-4 relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-15"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80)'
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-b from-dark/95 via-dark-light/90 to-dark/95"></div>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Our Services
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
            Comprehensive Investment Solutions Tailored for Your Success
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {displayServices.map((service) => {
            const Icon = iconMap[service.icon] || TrendingUp
            const features = service.features || []
            
            return (
              <div 
                key={service.id} 
                className="group card hover:border-primary transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 transform hover:-translate-y-2"
              >
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-4 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors flex-shrink-0">
                    <Icon className="text-primary" size={36} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-primary transition-colors">
                      {service.name}
                    </h3>
                  </div>
                </div>
                
                <p className="text-gray-400 mb-6 leading-relaxed">
                  {service.description}
                </p>

                {features.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                      <Sparkles size={16} className="text-primary" />
                      <span className="font-semibold">Key Features</span>
                    </div>
                    <ul className="space-y-2">
                      {features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Call to Action */}
        <div className="mt-16 text-center">
          <div className="card bg-gradient-to-r from-primary/10 to-transparent border-primary/20 inline-block">
            <h3 className="text-2xl font-bold text-white mb-3">Ready to Get Started?</h3>
            <p className="text-gray-300 mb-6">
              Choose from our comprehensive range of investment services and start building your wealth today.
            </p>
            <a
              href="/packages"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-3 rounded-lg transition-all duration-300"
            >
              View Investment Packages
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
