import { Link } from 'react-router-dom'
import { TrendingUp, Users, IndianRupee, ArrowRight, Layers, Percent } from 'lucide-react'

export default function MarketingPlan() {
  const incomeLevels = [
    { level: 1, percentage: '5%', description: 'Direct Referral Commission' },
    { level: 2, percentage: '10%', description: 'Level 2 Income' },
    { level: 3, percentage: '15%', description: 'Level 3 Income' },
    { level: 4, percentage: '20%', description: 'Level 4 Income' },
    { level: 5, percentage: '25%', description: 'Level 5 Income' },
    { level: 6, percentage: '25%', description: 'Level 6 Income' },
  ]

  return (
    <div className="min-h-screen py-16 px-4 relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-15"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1559526324-4b87b5e36e44?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80)'
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-b from-dark/95 via-dark-light/90 to-dark/95"></div>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Marketing Plan
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
            Earn Through Referrals & Multiple Income Levels
          </p>
        </div>

        {/* Main Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <Link 
            to="/referral-direct" 
            className="group card hover:border-primary transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 transform hover:-translate-y-2"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                <Users className="text-primary" size={36} />
              </div>
              <h3 className="text-2xl font-bold text-white group-hover:text-primary transition-colors">
                Direct Referral
              </h3>
            </div>
            <p className="text-gray-400 mb-4 leading-relaxed">
              5% commission on any plan your referrals purchase. Build your network and earn from every direct referral.
            </p>
            <div className="flex items-center gap-2 text-primary font-semibold">
              <span>Learn More</span>
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link 
            to="/roi-levels" 
            className="group card hover:border-primary transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 transform hover:-translate-y-2"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                <TrendingUp className="text-primary" size={36} />
              </div>
              <h3 className="text-2xl font-bold text-white group-hover:text-primary transition-colors">
                Level Income
              </h3>
            </div>
            <p className="text-gray-400 mb-4 leading-relaxed">
              Earn from multiple levels with up to 100% total ROI. Your network's growth becomes your income.
            </p>
            <div className="flex items-center gap-2 text-primary font-semibold">
              <span>Learn More</span>
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        {/* Total ROI Highlight */}
        <div className="card bg-gradient-to-r from-primary/10 to-transparent border-primary/20 mb-16">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="p-6 bg-primary/20 rounded-xl">
              <IndianRupee className="text-primary" size={48} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-3xl font-bold mb-2 text-white">
                Total Level Income on ROI = 100%
              </h3>
              <p className="text-gray-300 text-lg">
                Our comprehensive level system ensures maximum earning potential for all members. 
                Build your network and watch your income grow across multiple levels.
              </p>
            </div>
          </div>
        </div>

        {/* Income Levels Breakdown */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Income Level Structure</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {incomeLevels.map((item) => (
              <div key={item.level} className="card text-center hover:border-primary transition-colors">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Layers className="text-primary" size={24} />
                  <span className="text-sm text-gray-400">Level {item.level}</span>
                </div>
                <div className="text-4xl font-bold text-primary mb-2">{item.percentage}</div>
                <p className="text-gray-400 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="card bg-gradient-to-br from-dark-light to-dark">
          <h2 className="text-2xl font-bold mb-6 text-white">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                <span className="text-primary font-bold text-xl">1</span>
              </div>
              <h3 className="font-bold text-white mb-2">Join & Activate</h3>
              <p className="text-gray-400 text-sm">Choose your investment package and activate your account</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                <span className="text-primary font-bold text-xl">2</span>
              </div>
              <h3 className="font-bold text-white mb-2">Refer & Build</h3>
              <p className="text-gray-400 text-sm">Invite others to join and build your network across multiple levels</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                <span className="text-primary font-bold text-xl">3</span>
              </div>
              <h3 className="font-bold text-white mb-2">Earn & Grow</h3>
              <p className="text-gray-400 text-sm">Earn commissions from direct referrals and level income automatically</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
