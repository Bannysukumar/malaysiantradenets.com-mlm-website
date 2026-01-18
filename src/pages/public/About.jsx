import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'

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
  }

  const content = pageData || defaultContent

  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-center">{content.title}</h1>
        <p className="text-xl text-gray-300 mb-8 text-center">{content.subtitle}</p>
        <div className="card">
          <p className="text-gray-300 leading-relaxed text-lg whitespace-pre-line">
            {content.body || defaultContent.body}
          </p>
        </div>
      </div>
    </div>
  )
}

