import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ArrowRight } from 'lucide-react'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-dark via-dark-light to-dark py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Reflecting on Success,
            <br />
            Paving the Path Forward.
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Malaysian Trade Net - Your trusted partner in Forex Trading, Real Estate, and Investment opportunities.
          </p>
          <Link
            to={user ? '/app/dashboard' : '/auth'}
            className="inline-flex items-center gap-2 btn-primary text-lg px-8 py-4"
          >
            Get Started
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-16 px-4 bg-dark-light">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link to="/packages" className="card hover:border-primary transition-colors">
              <h3 className="text-xl font-bold text-white mb-2">Investment Packages</h3>
              <p className="text-gray-400">Choose from Bronze to Double Crown packages</p>
            </Link>
            <Link to="/marketing-plan" className="card hover:border-primary transition-colors">
              <h3 className="text-xl font-bold text-white mb-2">Marketing Plan</h3>
              <p className="text-gray-400">5% Direct Referral + Level Income System</p>
            </Link>
            <Link to="/services" className="card hover:border-primary transition-colors">
              <h3 className="text-xl font-bold text-white mb-2">Our Services</h3>
              <p className="text-gray-400">Forex, Share Market, Real Estate & More</p>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

