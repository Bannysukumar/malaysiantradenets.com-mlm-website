import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { ArrowRight, TrendingUp, Users, Building2, Package, Award, Shield, Zap } from 'lucide-react'

export default function Home() {
  const { user } = useAuth()
  const { data: homeContent } = useFirestore(doc(db, 'pages', 'home'))

  const defaultContent = {
    heroTitle: 'Reflecting on Success, Paving the Path Forward.',
    heroSubtitle: 'Malaysian Trade Net - Your trusted partner in Forex Trading, Real Estate, and Investment opportunities.',
    ctaText: 'Get Started',
  }

  const content = { ...defaultContent, ...homeContent }

  const features = [
    {
      icon: Package,
      title: 'Investment Packages',
      description: 'Choose from Bronze to Double Crown packages',
      link: '/packages',
    },
    {
      icon: Users,
      title: 'Marketing Plan',
      description: '5% Direct Referral + Level Income System',
      link: '/marketing-plan',
    },
    {
      icon: Building2,
      title: 'Our Services',
      description: 'Forex, Share Market, Real Estate & More',
      link: '/services',
    },
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section - Enhanced with gradient and animations */}
      <section className="relative bg-gradient-to-br from-dark via-dark-light to-dark py-24 md:py-32 px-4 overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
            style={{
              backgroundImage: 'url(https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80)'
            }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-br from-dark/90 via-dark-light/80 to-dark/90"></div>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              {content.heroTitle}
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
            {content.heroSubtitle}
          </p>
          <Link
            to={user ? '/app/dashboard' : '/auth'}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-4 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-primary/20"
          >
            {content.ctaText}
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Features Section - Enhanced with better spacing and hover effects */}
      <section className="relative py-20 px-4 bg-dark-light overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: 'url(https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80)'
            }}
          ></div>
        </div>
        <div className="relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Link
                  key={index}
                  to={feature.link}
                  className="group relative bg-dark border border-gray-800 rounded-xl p-8 hover:border-primary transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 transform hover:-translate-y-2"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="p-4 bg-primary/10 rounded-xl mb-4 group-hover:bg-primary/20 transition-colors">
                      <Icon className="text-primary" size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-primary transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                    <div className="mt-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                      <span className="text-sm font-semibold">Learn More</span>
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
        </div>
      </section>

      {/* Trust Indicators Section */}
      <section className="relative py-16 px-4 bg-dark overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 opacity-10">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: 'url(https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80)'
            }}
          ></div>
        </div>
        <div className="relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="flex flex-col items-center">
              <Shield className="text-primary mb-3" size={32} />
              <div className="text-3xl font-bold text-white mb-1">18+</div>
              <div className="text-sm text-gray-400">Years Experience</div>
            </div>
            <div className="flex flex-col items-center">
              <Users className="text-primary mb-3" size={32} />
              <div className="text-3xl font-bold text-white mb-1">10K+</div>
              <div className="text-sm text-gray-400">Active Members</div>
            </div>
            <div className="flex flex-col items-center">
              <Award className="text-primary mb-3" size={32} />
              <div className="text-3xl font-bold text-white mb-1">100%</div>
              <div className="text-sm text-gray-400">ROI Potential</div>
            </div>
            <div className="flex flex-col items-center">
              <Zap className="text-primary mb-3" size={32} />
              <div className="text-3xl font-bold text-white mb-1">24/7</div>
              <div className="text-sm text-gray-400">Support</div>
            </div>
          </div>
        </div>
        </div>
      </section>
    </div>
  )
}
