import { useFirestore } from '../../hooks/useFirestore'
import { doc, setDoc } from 'firebase/firestore'
import { db, storage } from '../../config/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Gift } from 'lucide-react'
import { useState } from 'react'

export default function AdminBonanza() {
  const { data: bonanza, loading } = useFirestore(doc(db, 'bonanza', 'main'))
  const [uploading, setUploading] = useState(false)
  const { register, handleSubmit } = useForm({
    defaultValues: bonanza || {
      title: 'Bonanza Coming Soon',
      enabled: true,
      description: '',
    },
  })

  const uploadFile = async (file, path) => {
    if (!file) return null
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file)
    return await getDownloadURL(storageRef)
  }

  const onSubmit = async (data) => {
    try {
      setUploading(true)
      const updates = { ...data }
      updates.enabled = data.enabled === true || data.enabled === 'true'
      delete updates.bannerFile

      if (data.bannerFile && data.bannerFile[0]) {
        try {
          updates.bannerUrl = await uploadFile(data.bannerFile[0], `bonanza/banner-${Date.now()}`)
        } catch (uploadError) {
          console.error('Banner upload error:', uploadError)
          toast.error('Error uploading banner: ' + (uploadError.message || 'Unknown error'))
          return
        }
      }

      await setDoc(doc(db, 'bonanza', 'main'), updates, { merge: true })
      toast.success('Bonanza updated successfully')
    } catch (error) {
      console.error('Bonanza update error:', error)
      toast.error('Error updating bonanza: ' + (error.message || 'Unknown error'))
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <Gift className="text-primary" size={32} />
        Bonanza Configuration
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register('enabled')}
            className="w-4 h-4"
          />
          <label className="text-sm font-medium">Enable Bonanza Page</label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Title</label>
          <input
            type="text"
            {...register('title')}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description</label>
          <textarea
            {...register('description')}
            className="input-field min-h-[150px]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Banner Image</label>
          <input
            type="file"
            {...register('bannerFile')}
            accept="image/*"
            className="input-field"
          />
          {bonanza?.bannerUrl && (
            <img src={bonanza.bannerUrl} alt="Banner" className="mt-2 max-w-md rounded" />
          )}
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="btn-primary"
        >
          {uploading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}

