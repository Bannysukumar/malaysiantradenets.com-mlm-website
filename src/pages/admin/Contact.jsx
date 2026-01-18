import { useFirestore } from '../../hooks/useFirestore'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Phone } from 'lucide-react'

export default function AdminContact() {
  const { data: contactData, loading } = useFirestore(doc(db, 'contact', 'main'))
  const { register, handleSubmit } = useForm({
    defaultValues: contactData || {
      website: 'www.malaysiantradenet.com',
      email: 'info@malaysiantradenet.com',
      phone: '',
      socialLinks: {},
    },
  })

  const onSubmit = async (data) => {
    try {
      // Parse socialLinks if it's a string
      const updates = { ...data }
      if (typeof data.socialLinks === 'string' && data.socialLinks.trim()) {
        try {
          updates.socialLinks = JSON.parse(data.socialLinks)
        } catch (e) {
          // If JSON parse fails, keep as string or set to empty object
          updates.socialLinks = {}
        }
      }
      await setDoc(doc(db, 'contact', 'main'), updates, { merge: true })
      toast.success('Contact information updated')
    } catch (error) {
      console.error('Contact update error:', error)
      toast.error('Error updating contact information: ' + (error.message || 'Unknown error'))
    }
  }

  if (loading) {
    return <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <Phone className="text-primary" size={32} />
        Contact Information
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Website URL</label>
          <input
            type="text"
            {...register('website')}
            className="input-field"
            placeholder="www.malaysiantradenet.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            {...register('email')}
            className="input-field"
            placeholder="info@malaysiantradenet.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Phone</label>
          <input
            type="text"
            {...register('phone')}
            className="input-field"
            placeholder="+60 123 456 7890"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Social Media Links (JSON format)</label>
          <textarea
            {...register('socialLinks')}
            className="input-field min-h-[150px] font-mono text-sm"
            placeholder='{"facebook": "https://facebook.com/...", "twitter": "https://twitter.com/..."}'
          />
        </div>

        <button type="submit" className="btn-primary">
          Save Changes
        </button>
      </form>
    </div>
  )
}

