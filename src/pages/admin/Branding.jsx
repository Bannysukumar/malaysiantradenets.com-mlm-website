import { useState } from 'react'
import { useFirestore } from '../../hooks/useFirestore'
import { doc, updateDoc, setDoc } from 'firebase/firestore'
import { db, storage } from '../../config/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Upload, Palette } from 'lucide-react'

export default function AdminBranding() {
  const { data: siteConfig, loading } = useFirestore(doc(db, 'siteConfig', 'main'))
  const { register, handleSubmit, watch } = useForm({
    defaultValues: siteConfig || {},
  })
  const [uploading, setUploading] = useState(false)

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

      // Remove file inputs from updates
      delete updates.logoFile
      delete updates.faviconFile

      // Handle logo upload
      if (data.logoFile && data.logoFile[0]) {
        try {
          updates.logoUrl = await uploadFile(data.logoFile[0], `branding/logo-${Date.now()}`)
        } catch (uploadError) {
          console.error('Logo upload error:', uploadError)
          toast.error('Error uploading logo: ' + (uploadError.message || 'Unknown error'))
          return
        }
      }

      // Handle favicon upload
      if (data.faviconFile && data.faviconFile[0]) {
        try {
          updates.faviconUrl = await uploadFile(data.faviconFile[0], `branding/favicon-${Date.now()}`)
        } catch (uploadError) {
          console.error('Favicon upload error:', uploadError)
          toast.error('Error uploading favicon: ' + (uploadError.message || 'Unknown error'))
          return
        }
      }

      // Use setDoc with merge to create if doesn't exist, or update if it does
      const siteConfigRef = doc(db, 'siteConfig', 'main')
      await setDoc(siteConfigRef, updates, { merge: true })
      
      toast.success('Branding updated successfully')
    } catch (error) {
      console.error('Branding update error:', error)
      toast.error('Error updating branding: ' + (error.message || 'Unknown error'))
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
        <Palette className="text-primary" size={32} />
        Branding
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Company Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Company Name</label>
              <input
                type="text"
                {...register('brandName')}
                className="input-field"
                placeholder="Malaysian Trade Net"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Logo</label>
              <input
                type="file"
                {...register('logoFile')}
                accept="image/*"
                className="input-field"
              />
              {siteConfig?.logoUrl && (
                <img src={siteConfig.logoUrl} alt="Logo" className="mt-2 h-20" />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Favicon</label>
              <input
                type="file"
                {...register('faviconFile')}
                accept="image/*"
                className="input-field"
              />
              {siteConfig?.faviconUrl && (
                <img src={siteConfig.faviconUrl} alt="Favicon" className="mt-2 h-16" />
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">Theme Colors</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Primary Color</label>
              <input
                type="color"
                {...register('primaryColor')}
                defaultValue={siteConfig?.primaryColor || '#DC2626'}
                className="w-full h-12 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Secondary Color</label>
              <input
                type="color"
                {...register('secondaryColor')}
                defaultValue={siteConfig?.secondaryColor || '#B91C1C'}
                className="w-full h-12 rounded"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">Footer Information</h2>
          <div className="space-y-4">
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
          </div>
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="btn-primary flex items-center gap-2"
        >
          <Upload size={20} />
          {uploading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}

