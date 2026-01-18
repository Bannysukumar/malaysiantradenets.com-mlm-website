import { Link } from 'react-router-dom'
import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'

export default function Footer() {
  const { data: siteConfig } = useFirestore(doc(db, 'siteConfig', 'main'))

  const website = siteConfig?.website || 'www.malaysiantradenet.com'
  const email = siteConfig?.email || 'info@malaysiantradenet.com'

  return (
    <footer className="bg-dark-light border-t border-gray-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold text-primary mb-4">MTN</h3>
            <p className="text-gray-400 text-sm">
              Reflecting on Success, Paving the Path Forward.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="text-gray-400 hover:text-white">About Us</Link></li>
              <li><Link to="/services" className="text-gray-400 hover:text-white">Services</Link></li>
              <li><Link to="/packages" className="text-gray-400 hover:text-white">Packages</Link></li>
              <li><Link to="/terms" className="text-gray-400 hover:text-white">Terms & Conditions</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/terms" className="text-gray-400 hover:text-white">Terms & Conditions</Link></li>
              <li><Link to="/contact" className="text-gray-400 hover:text-white">Contact Us</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>Website: <a href={`https://${website}`} target="_blank" rel="noopener noreferrer" className="hover:text-white">{website}</a></li>
              <li>Email: <a href={`mailto:${email}`} className="hover:text-white">{email}</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} Malaysian Trade Net. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

