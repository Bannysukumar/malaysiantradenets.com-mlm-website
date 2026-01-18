import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { Target, Eye } from 'lucide-react'

export default function MissionVision() {
  const { data: pageData, loading } = useFirestore(doc(db, 'pages', 'mission-vision'))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const defaultContent = {
    mission: 'To empower individuals and businesses with innovative investment solutions, providing them with opportunities to achieve financial independence through trusted and transparent investment channels.',
    vision: 'To become a leading global investment platform, recognized for excellence, integrity, and innovation in Forex Trading, Real Estate, and emerging investment opportunities.',
  }

  const content = pageData || defaultContent

  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-12 text-center">Mission & Vision</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <Target className="text-primary" size={32} />
              <h2 className="text-2xl font-bold">Our Mission</h2>
            </div>
            <p className="text-gray-300 leading-relaxed">
              {content.mission || defaultContent.mission}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="text-primary" size={32} />
              <h2 className="text-2xl font-bold">Our Vision</h2>
            </div>
            <p className="text-gray-300 leading-relaxed">
              {content.vision || defaultContent.vision}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

