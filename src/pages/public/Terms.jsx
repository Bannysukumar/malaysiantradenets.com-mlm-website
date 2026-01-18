import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { FileText } from 'lucide-react'

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

  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <FileText className="text-primary" size={32} />
          <h1 className="text-4xl md:text-5xl font-bold">Terms & Conditions</h1>
        </div>
        <div className="card">
          <div className="text-gray-300 whitespace-pre-line leading-relaxed">
            {content}
          </div>
        </div>
      </div>
    </div>
  )
}

