import { useState } from 'react'
import { useFirestore } from '../../hooks/useFirestore'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { FileText } from 'lucide-react'

const pages = [
  { id: 'about', name: 'About Us', slug: '/about' },
  { id: 'mission-vision', name: 'Mission & Vision', slug: '/mission-vision' },
  { id: 'future', name: 'Future Plans', slug: '/future' },
  { id: 'why-choose-us', name: 'Why Choose Us', slug: '/why-choose-us' },
]

export default function AdminContent() {
  const [selectedPage, setSelectedPage] = useState(pages[0].id)
  const { data: pageData, loading } = useFirestore(doc(db, 'pages', selectedPage))
  const { register, handleSubmit } = useForm({
    defaultValues: pageData || {},
  })

  const onSubmit = async (data) => {
    try {
      await setDoc(doc(db, 'pages', selectedPage), {
        ...data,
        lastUpdated: new Date(),
      }, { merge: true })
      toast.success('Content updated successfully')
    } catch (error) {
      console.error('Content update error:', error)
      toast.error('Error updating content: ' + (error.message || 'Unknown error'))
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <FileText className="text-primary" size={32} />
        Content Management
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Pages</h2>
          <div className="space-y-2">
            {pages.map((page) => (
              <button
                key={page.id}
                onClick={() => setSelectedPage(page.id)}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                  selectedPage === page.id
                    ? 'bg-primary text-white'
                    : 'bg-dark-lighter text-gray-300 hover:bg-dark-lighter/80'
                }`}
              >
                {page.name}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6">
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

            <button type="submit" className="btn-primary">
              Save Changes
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

