import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { 
  IndianRupee, 
  Coins, 
  Wallet, 
  Gift, 
  Building2, 
  Award 
} from 'lucide-react'

const defaultBenefits = [
  { icon: IndianRupee, title: 'Dual Income', description: 'Multiple income streams from packages and referrals' },
  { icon: Coins, title: 'INR & Crypto Friendly', description: 'Support for both traditional and digital currencies' },
  { icon: Wallet, title: 'Instant Wallet Credit', description: 'Fast and secure wallet transactions' },
  { icon: Gift, title: 'Excellent Bonanzas', description: 'Regular bonuses and special promotions' },
  { icon: Building2, title: 'Real Estate Investment', description: 'Diversified portfolio including real estate' },
  { icon: Award, title: 'Awards & Rewards', description: 'Recognition and rewards for top performers' },
]

export default function WhyChooseUs() {
  const { data: pageData, loading } = useFirestore(doc(db, 'pages', 'why-choose-us'))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const benefits = pageData?.benefits || defaultBenefits

  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center">Why Choose Us</h1>
        <p className="text-xl text-gray-300 mb-12 text-center">Benefits That Set Us Apart</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon || defaultBenefits[index]?.icon || IndianRupee
            return (
              <div key={index} className="card hover:border-primary transition-colors">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-primary/20 rounded-lg">
                    <Icon className="text-primary" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-white">{benefit.title}</h3>
                </div>
                <p className="text-gray-400">{benefit.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

