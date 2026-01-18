import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { Gift } from 'lucide-react'

export default function Bonanza() {
  const { data: bonanza, loading } = useFirestore(doc(db, 'bonanza', 'main'))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const defaultContent = {
    title: 'Bonanza Coming Soon',
    enabled: true,
  }

  const content = bonanza || defaultContent

  if (!content.enabled) {
    return null
  }

  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="card text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-primary/20 rounded-full">
              <Gift className="text-primary" size={48} />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            {content.title || defaultContent.title}
          </h1>
          {content.description && (
            <p className="text-gray-300 text-lg">{content.description}</p>
          )}
        </div>
      </div>
    </div>
  )
}

