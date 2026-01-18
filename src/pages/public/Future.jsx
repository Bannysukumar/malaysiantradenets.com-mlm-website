import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { Rocket } from 'lucide-react'

export default function Future() {
  const { data: pageData, loading } = useFirestore(doc(db, 'pages', 'future'))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const defaultContent = {
    title: 'Future Plans',
    body: 'Company planning to launch own crypto coin in future. This will provide additional investment opportunities and expand our portfolio of services to better serve our clients.',
  }

  const content = pageData || defaultContent

  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="card text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-primary/20 rounded-full">
              <Rocket className="text-primary" size={48} />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">{content.title || defaultContent.title}</h1>
          <p className="text-gray-300 leading-relaxed text-lg max-w-2xl mx-auto">
            {content.body || defaultContent.body}
          </p>
        </div>
      </div>
    </div>
  )
}

