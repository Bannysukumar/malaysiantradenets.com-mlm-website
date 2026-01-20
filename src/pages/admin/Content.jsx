import { useState, useEffect } from 'react'
import { useFirestore } from '../../hooks/useFirestore'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { FileText, Home, Info, Briefcase, Package, TrendingUp, FileCheck, Mail, Save } from 'lucide-react'

const pages = [
  { id: 'home', name: 'Home Page', slug: '/', icon: Home },
  { id: 'about', name: 'About Us', slug: '/about', icon: Info },
  { id: 'mission-vision', name: 'Mission & Vision', slug: '/mission-vision', icon: FileText },
  { id: 'future', name: 'Future Plans', slug: '/future', icon: FileText },
  { id: 'why-choose-us', name: 'Why Choose Us', slug: '/why-choose-us', icon: FileText },
]

const configPages = [
  { id: 'terms', name: 'Terms & Conditions', collection: 'terms', icon: FileCheck },
  { id: 'contact', name: 'Contact Information', collection: 'contact', icon: Mail },
]

export default function AdminContent() {
  const [selectedPage, setSelectedPage] = useState(pages[0].id)
  const [selectedConfigPage, setSelectedConfigPage] = useState(null)
  const [activeTab, setActiveTab] = useState('pages') // 'pages' or 'config'
  
  const { data: pageData, loading } = useFirestore(
    selectedPage ? doc(db, 'pages', selectedPage) : null
  )
  
  const { data: configData, loading: configLoading } = useFirestore(
    selectedConfigPage 
      ? doc(db, selectedConfigPage.collection, selectedConfigPage.id === 'terms' ? 'main' : 'main')
      : null
  )

  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: {},
  })

  // Reset form when page data changes
  useEffect(() => {
    if (selectedPage && pageData) {
      reset(pageData)
    } else if (selectedConfigPage && configData) {
      reset(configData)
    }
  }, [pageData, configData, selectedPage, selectedConfigPage, reset])

  const onSubmit = async (data) => {
    try {
      if (selectedConfigPage) {
        // Save to config collection
        await setDoc(
          doc(db, selectedConfigPage.collection, selectedConfigPage.id === 'terms' ? 'main' : 'main'),
          {
            ...data,
            lastUpdated: new Date(),
          },
          { merge: true }
        )
        toast.success(`${selectedConfigPage.name} updated successfully`)
      } else if (selectedPage) {
        // Save to pages collection
        await setDoc(
          doc(db, 'pages', selectedPage),
          {
            ...data,
            lastUpdated: new Date(),
          },
          { merge: true }
        )
        toast.success('Content updated successfully')
      }
    } catch (error) {
      console.error('Content update error:', error)
      toast.error('Error updating content: ' + (error.message || 'Unknown error'))
    }
  }

  const currentLoading = activeTab === 'pages' ? loading : configLoading
  const currentData = activeTab === 'pages' ? pageData : configData

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="text-primary" size={32} />
          Content Management
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-800">
        <button
          onClick={() => {
            setActiveTab('pages')
            setSelectedConfigPage(null)
            setSelectedPage(pages[0].id)
          }}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === 'pages'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Pages Content
        </button>
        <button
          onClick={() => {
            setActiveTab('config')
            setSelectedPage(null)
            setSelectedConfigPage(configPages[0])
          }}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === 'config'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Configuration
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">
            {activeTab === 'pages' ? 'Pages' : 'Settings'}
          </h2>
          <div className="space-y-2">
            {activeTab === 'pages' ? (
              pages.map((page) => {
                const Icon = page.icon
                return (
                  <button
                    key={page.id}
                    onClick={() => {
                      setSelectedPage(page.id)
                      setSelectedConfigPage(null)
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                      selectedPage === page.id
                        ? 'bg-primary text-white'
                        : 'bg-dark-lighter text-gray-300 hover:bg-dark-lighter/80'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{page.name}</span>
                  </button>
                )
              })
            ) : (
              configPages.map((page) => {
                const Icon = page.icon
                return (
                  <button
                    key={page.id}
                    onClick={() => {
                      setSelectedConfigPage(page)
                      setSelectedPage(null)
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                      selectedConfigPage?.id === page.id
                        ? 'bg-primary text-white'
                        : 'bg-dark-lighter text-gray-300 hover:bg-dark-lighter/80'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{page.name}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {currentLoading ? (
            <div className="card flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6">
              {selectedPage === 'home' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Hero Title</label>
                    <input
                      type="text"
                      {...register('heroTitle')}
                      className="input-field"
                      placeholder="Reflecting on Success, Paving the Path Forward."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Hero Subtitle</label>
                    <textarea
                      {...register('heroSubtitle')}
                      className="input-field min-h-[100px]"
                      placeholder="Malaysian Trade Net - Your trusted partner..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">CTA Button Text</label>
                    <input
                      type="text"
                      {...register('ctaText')}
                      className="input-field"
                      placeholder="Get Started"
                    />
                  </div>
                </>
              )}

              {selectedPage === 'about' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Title</label>
                    <input
                      type="text"
                      {...register('title')}
                      className="input-field"
                      placeholder="About Us"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Subtitle</label>
                    <input
                      type="text"
                      {...register('subtitle')}
                      className="input-field"
                      placeholder="Your Trusted Investment Partner"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Main Content</label>
                    <textarea
                      {...register('body')}
                      className="input-field min-h-[200px]"
                      placeholder="Enter main content..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Mission</label>
                    <textarea
                      {...register('mission')}
                      className="input-field min-h-[100px]"
                      placeholder="Enter mission statement..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Vision</label>
                    <textarea
                      {...register('vision')}
                      className="input-field min-h-[100px]"
                      placeholder="Enter vision statement..."
                    />
                  </div>
                </>
              )}

              {selectedPage && selectedPage !== 'home' && selectedPage !== 'about' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Title</label>
                    <input
                      type="text"
                      {...register('title')}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Subtitle</label>
                    <input
                      type="text"
                      {...register('subtitle')}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Content</label>
                    <textarea
                      {...register('body')}
                      className="input-field min-h-[300px]"
                      placeholder="Enter page content..."
                    />
                  </div>
                </>
              )}

              {selectedConfigPage?.id === 'terms' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Terms & Conditions Content</label>
                  <textarea
                    {...register('content')}
                    className="input-field min-h-[400px] font-mono text-sm"
                    placeholder="Enter terms and conditions..."
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Use numbered lists (1., 2., etc.) for better formatting. Separate sections with blank lines.
                  </p>
                </div>
              )}

              {selectedConfigPage?.id === 'contact' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Phone Number</label>
                    <input
                      type="text"
                      {...register('phone')}
                      className="input-field"
                      placeholder="+1234567890"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Address</label>
                    <textarea
                      {...register('address')}
                      className="input-field min-h-[100px]"
                      placeholder="Enter full address..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Office Hours</label>
                    <input
                      type="text"
                      {...register('officeHours')}
                      className="input-field"
                      placeholder="Monday - Friday: 9:00 AM - 6:00 PM"
                    />
                  </div>
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm text-yellow-400">
                      <strong>Note:</strong> Website and Email are managed in Branding settings.
                    </p>
                  </div>
                </>
              )}

              <div className="flex items-center gap-4 pt-4 border-t border-gray-800">
                <button 
                  type="submit" 
                  className="btn-primary flex items-center gap-2"
                >
                  <Save size={18} />
                  Save Changes
                </button>
                {selectedPage && (
                  <a
                    href={`${selectedPage === 'home' ? '/' : `/${selectedPage === 'about' ? 'about' : selectedPage}`}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white text-sm"
                  >
                    Preview Page →
                  </a>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
