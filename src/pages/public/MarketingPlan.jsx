import { Link } from 'react-router-dom'
import { TrendingUp, Users, DollarSign } from 'lucide-react'

export default function MarketingPlan() {
  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center">Marketing Plan</h1>
        <p className="text-xl text-gray-300 mb-12 text-center">Earn Through Referrals & Levels</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <Link to="/referral-direct" className="card hover:border-primary transition-colors">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-primary/20 rounded-lg">
                <Users className="text-primary" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-white">Direct Referral</h3>
            </div>
            <p className="text-gray-400 mb-4">5% commission on any plan your referrals purchase</p>
            <span className="text-primary font-semibold">Learn More →</span>
          </Link>

          <Link to="/roi-levels" className="card hover:border-primary transition-colors">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-primary/20 rounded-lg">
                <TrendingUp className="text-primary" size={32} />
              </div>
              <h3 className="text-2xl font-bold text-white">Level Income</h3>
            </div>
            <p className="text-gray-400 mb-4">Earn from multiple levels with up to 100% total ROI</p>
            <span className="text-primary font-semibold">Learn More →</span>
          </Link>
        </div>

        <div className="card text-center">
          <DollarSign className="text-primary mx-auto mb-4" size={48} />
          <h3 className="text-2xl font-bold mb-4">Total Level Income on ROI = 100%</h3>
          <p className="text-gray-400">
            Our comprehensive level system ensures maximum earning potential for all members.
          </p>
        </div>
      </div>
    </div>
  )
}

