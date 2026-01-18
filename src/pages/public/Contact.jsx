import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { Mail, Globe, Phone } from 'lucide-react'

export default function Contact() {
  const { data: siteConfig, loading } = useFirestore(doc(db, 'siteConfig', 'main'))
  const { data: contactData } = useFirestore(doc(db, 'contact', 'main'))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const website = siteConfig?.website || contactData?.website || 'www.malaysiantradenet.com'
  const email = siteConfig?.email || contactData?.email || 'info@malaysiantradenet.com'
  const phone = contactData?.phone || ''

  return (
    <div className="min-h-screen py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center">Thank You</h1>
        <p className="text-xl text-gray-300 mb-12 text-center">Get in Touch With Us</p>

        <div className="card space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-lg">
              <Globe className="text-primary" size={24} />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Website</p>
              <a
                href={`https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-primary font-semibold"
              >
                {website}
              </a>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-lg">
              <Mail className="text-primary" size={24} />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Email</p>
              <a
                href={`mailto:${email}`}
                className="text-white hover:text-primary font-semibold"
              >
                {email}
              </a>
            </div>
          </div>

          {phone && (
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/20 rounded-lg">
                <Phone className="text-primary" size={24} />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Phone</p>
                <a
                  href={`tel:${phone}`}
                  className="text-white hover:text-primary font-semibold"
                >
                  {phone}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

