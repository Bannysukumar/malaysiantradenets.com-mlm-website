import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { Target, Eye, Award, Users, TrendingUp, Shield } from 'lucide-react'

export default function About() {
  const { data: pageData, loading } = useFirestore(doc(db, 'pages', 'about'))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const defaultContent = {
    title: 'About Us',
    subtitle: 'Your Trusted Investment Partner',
    body: 'Malaysian Trade Net is a trusted name in Real Estate and Forex Trading. We have been serving our clients with integrity and excellence, providing them with opportunities to grow their wealth through various investment channels including Forex Trading, Share Market, Real Estate, Gold Mining, and Crypto Mining.',
    mission: 'To empower individuals and businesses with innovative investment solutions that drive sustainable growth and financial prosperity.',
    vision: 'To become the leading platform for diversified investment opportunities, recognized for transparency, integrity, and exceptional returns.',
  }

  const content = { ...defaultContent, ...pageData }

  const values = [
    {
      icon: Shield,
      title: 'Trust & Integrity',
      description: 'We operate with complete transparency and ethical practices in all our dealings.',
    },
    {
      icon: TrendingUp,
      title: 'Growth Focused',
      description: 'Our strategies are designed to maximize returns while managing risks effectively.',
    },
    {
      icon: Users,
      title: 'Client Centric',
      description: 'Your success is our priority. We provide personalized support and guidance.',
    },
    {
      icon: Award,
      title: 'Excellence',
      description: 'We maintain the highest standards in service delivery and investment management.',
    },
  ]

  return (
    <div className="min-h-screen py-16 px-4 relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-15"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80)'
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-b from-dark/95 via-dark-light/90 to-dark/95"></div>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            {content.title}
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
            {content.subtitle}
          </p>
        </div>

        {/* Main Content */}
        <div className="card mb-12">
          <div className="prose prose-invert max-w-none">
            <p className="text-lg text-gray-300 leading-relaxed whitespace-pre-line">
              {content.body}
            </p>
          </div>
        </div>

        {/* Mission & Vision Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="card bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-primary/20 rounded-lg">
                <Target className="text-primary" size={28} />
              </div>
              <h2 className="text-2xl font-bold text-white">Our Mission</h2>
            </div>
            <p className="text-gray-300 leading-relaxed">
              {content.mission}
            </p>
          </div>

          <div className="card bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-primary/20 rounded-lg">
                <Eye className="text-primary" size={28} />
              </div>
              <h2 className="text-2xl font-bold text-white">Our Vision</h2>
            </div>
            <p className="text-gray-300 leading-relaxed">
              {content.vision}
            </p>
          </div>
        </div>

        {/* Core Values */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-center mb-8">Our Core Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => {
              const Icon = value.icon
              return (
                <div key={index} className="card text-center hover:border-primary transition-colors">
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-primary/10 rounded-xl">
                      <Icon className="text-primary" size={32} />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{value.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{value.description}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Why Choose Us Section */}
        <div className="card bg-gradient-to-r from-primary/5 to-transparent">
          <h2 className="text-2xl font-bold mb-4 text-white">Why Choose Malaysian Trade Net?</h2>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <span>18+ years of experience in investment management and financial services</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <span>Diversified investment portfolio across multiple asset classes</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <span>Transparent operations with regular updates and reporting</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <span>Expert team of financial analysts and investment advisors</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
              <span>Comprehensive support and guidance throughout your investment journey</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
