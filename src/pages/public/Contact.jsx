import { useFirestore } from '../../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { Mail, Globe, Phone, MapPin, Clock, Send } from 'lucide-react'

export default function Contact() {
  const { data: siteConfig, loading: siteLoading } = useFirestore(doc(db, 'siteConfig', 'main'))
  const { data: contactData, loading: contactLoading } = useFirestore(doc(db, 'contact', 'main'))

  if (siteLoading || contactLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const website = siteConfig?.website || contactData?.website || 'www.malaysiantradenet.com'
  const email = siteConfig?.email || contactData?.email || 'info@malaysiantradenet.com'
  const phone = contactData?.phone || ''
  const address = contactData?.address || ''
  const officeHours = contactData?.officeHours || 'Monday - Friday: 9:00 AM - 6:00 PM'

  const contactMethods = [
    {
      icon: Globe,
      label: 'Website',
      value: website,
      link: `https://${website}`,
      type: 'link',
    },
    {
      icon: Mail,
      label: 'Email',
      value: email,
      link: `mailto:${email}`,
      type: 'email',
    },
    ...(phone ? [{
      icon: Phone,
      label: 'Phone',
      value: phone,
      link: `tel:${phone}`,
      type: 'phone',
    }] : []),
    ...(address ? [{
      icon: MapPin,
      label: 'Address',
      value: address,
      link: null,
      type: 'text',
    }] : []),
  ]

  return (
    <div className="min-h-screen py-16 px-4 relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-15"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80)'
          }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-b from-dark/95 via-dark-light/90 to-dark/95"></div>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Contact Us
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
            Get in Touch With Us - We're Here to Help
          </p>
        </div>

        {/* Contact Methods Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {contactMethods.map((method, index) => {
            const Icon = method.icon
            const isLink = method.type === 'link' || method.type === 'email' || method.type === 'phone'
            
            return (
              <div
                key={index}
                className="card hover:border-primary transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 transform hover:-translate-y-1"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg flex-shrink-0">
                    <Icon className="text-primary" size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-400 text-sm mb-1">{method.label}</p>
                    {isLink && method.link ? (
                      <a
                        href={method.link}
                        target={method.type === 'link' ? '_blank' : undefined}
                        rel={method.type === 'link' ? 'noopener noreferrer' : undefined}
                        className="text-white hover:text-primary font-semibold transition-colors break-all"
                      >
                        {method.value}
                      </a>
                    ) : (
                      <p className="text-white font-semibold">{method.value}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {officeHours && (
            <div className="card hover:border-primary transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-lg flex-shrink-0">
                  <Clock className="text-primary" size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-gray-400 text-sm mb-1">Office Hours</p>
                  <p className="text-white font-semibold">{officeHours}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Contact Form Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="card">
            <h2 className="text-2xl font-bold text-white mb-6">Send Us a Message</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Your Email
                </label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="What is this regarding?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Message
                </label>
                <textarea
                  className="input-field min-h-[150px]"
                  placeholder="Tell us how we can help..."
                />
              </div>
              <button
                type="submit"
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                <Send size={18} />
                Send Message
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="card bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
              <h3 className="text-xl font-bold text-white mb-4">Why Contact Us?</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span>Get answers to your investment questions</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span>Learn more about our packages and services</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span>Receive personalized investment guidance</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span>Report any issues or concerns</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span>Join our investment community</span>
                </li>
              </ul>
            </div>

            <div className="card">
              <h3 className="text-lg font-bold text-white mb-3">Response Time</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                We typically respond to all inquiries within 24-48 hours during business days. 
                For urgent matters, please call us directly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
