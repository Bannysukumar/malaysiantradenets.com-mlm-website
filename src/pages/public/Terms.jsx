import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { FileText, CheckCircle, AlertCircle, Clock, CreditCard, Shield } from 'lucide-react'

export default function Terms() {
  const { data: terms, loading } = useFirestore(doc(db, 'terms', 'main'))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const defaultTerms = `Terms & Conditions

1. ROI is paid weekly (Monday to Friday working days)
2. Cutoff time: Friday 5:00 PM
3. Payout release: Monday
4. Admin charges: 10% on all transactions
5. Payment methods: INR and USDT
6. ID renewal required after 3x package activation
7. All incomes are added to wallet balance
8. Terms and conditions are subject to change without prior notice`

  const content = terms?.content || defaultTerms

  // Parse content into structured sections
  const sections = content.split('\n\n').filter(s => s.trim())

  return (
    <div className="min-h-screen py-16 px-4 relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-15"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1450101499163-c8848c66ca85?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80)'
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-b from-dark/95 via-dark-light/90 to-dark/95"></div>
      </div>
      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-12">
          <div className="p-4 bg-primary/10 rounded-xl">
            <FileText className="text-primary" size={40} />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Terms & Conditions
            </h1>
            <p className="text-gray-400 mt-2">Please read our terms carefully</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="card mb-8">
          <div className="prose prose-invert max-w-none">
            {sections.map((section, index) => {
              // Check if it's a numbered list item
              const isListItem = /^\d+\./.test(section.trim())
              
              if (isListItem) {
                const parts = section.split('\n')
                const title = parts[0]
                const description = parts.slice(1).join('\n')
                
                return (
                  <div key={index} className="mb-6 pb-6 border-b border-gray-800 last:border-0">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                        <CheckCircle className="text-primary" size={20} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                        {description && (
                          <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                            {description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              }
              
              return (
                <div key={index} className="mb-4">
                  <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                    {section}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Key Points Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="card bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="text-primary" size={24} />
              <h3 className="text-lg font-bold text-white">Payout Schedule</h3>
            </div>
            <p className="text-gray-300 text-sm">
              Weekly payouts processed Monday to Friday. Cutoff time is Friday 5:00 PM, with releases on Monday.
            </p>
          </div>

          <div className="card bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
            <div className="flex items-center gap-3 mb-3">
              <CreditCard className="text-primary" size={24} />
              <h3 className="text-lg font-bold text-white">Payment Methods</h3>
            </div>
            <p className="text-gray-300 text-sm">
              We accept payments in INR and USDT. All transactions are subject to a 10% admin charge.
            </p>
          </div>

          <div className="card bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
            <div className="flex items-center gap-3 mb-3">
              <Shield className="text-primary" size={24} />
              <h3 className="text-lg font-bold text-white">Account Management</h3>
            </div>
            <p className="text-gray-300 text-sm">
              ID renewal required after 3x package activation. All incomes are automatically added to your wallet balance.
            </p>
          </div>

          <div className="card bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="text-primary" size={24} />
              <h3 className="text-lg font-bold text-white">Policy Updates</h3>
            </div>
            <p className="text-gray-300 text-sm">
              Terms and conditions are subject to change without prior notice. Please review regularly.
            </p>
          </div>
        </div>

        {/* Contact for Questions */}
        <div className="card bg-gradient-to-r from-primary/5 to-transparent text-center">
          <h3 className="text-xl font-bold text-white mb-2">Have Questions?</h3>
          <p className="text-gray-300 mb-4">
            If you have any questions about our terms and conditions, please don't hesitate to contact us.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-semibold"
          >
            Contact Us
            <FileText size={18} />
          </a>
        </div>
      </div>
    </div>
  )
}
