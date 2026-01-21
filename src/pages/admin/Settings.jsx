import { useEffect } from 'react'
import { useFirestore } from '../../hooks/useFirestore'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Settings as SettingsIcon, Shield, DollarSign, Search, CheckCircle2 } from 'lucide-react'

export default function AdminSettings() {
  const { data: settings, loading: settingsLoading } = useFirestore(doc(db, 'settings', 'main'))
  const { data: adminConfig, loading: configLoading } = useFirestore(doc(db, 'adminConfig', 'verification'))
  const loading = settingsLoading || configLoading
  
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      autoVerifyBank: false,
      autoVerifyKYC: false,
      requireEmailVerification: false,
      requireKYC: false,
      enablePayments: false,
      enableWalletCrediting: false,
      seoTitle: '',
      seoDescription: '',
    },
  })

  // Reset form when data loads from Firestore
  useEffect(() => {
    // Only reset when loading is complete
    if (!loading) {
      reset({
        autoVerifyBank: adminConfig?.autoVerifyBank === true,
        autoVerifyKYC: adminConfig?.autoVerifyKYC === true,
        requireEmailVerification: settings?.requireEmailVerification === true,
        requireKYC: settings?.requireKYC === true,
        enablePayments: settings?.enablePayments === true,
        enableWalletCrediting: settings?.enableWalletCrediting === true,
        seoTitle: settings?.seoTitle || '',
        seoDescription: settings?.seoDescription || '',
      })
    }
  }, [settings, adminConfig, loading, reset])

  const onSubmit = async (data) => {
    try {
      // Update settings
      await setDoc(doc(db, 'settings', 'main'), {
        requireEmailVerification: data.requireEmailVerification === true || data.requireEmailVerification === 'true',
        requireKYC: data.requireKYC === true || data.requireKYC === 'true',
        enablePayments: data.enablePayments === true || data.enablePayments === 'true',
        enableWalletCrediting: data.enableWalletCrediting === true || data.enableWalletCrediting === 'true',
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
      }, { merge: true })
      
      // Update admin config for auto-verification
      await setDoc(doc(db, 'adminConfig', 'verification'), {
        autoVerifyBank: data.autoVerifyBank === true || data.autoVerifyBank === 'true',
        autoVerifyKYC: data.autoVerifyKYC === true || data.autoVerifyKYC === 'true',
        updatedAt: new Date(),
      }, { merge: true })
      
      toast.success('Settings updated successfully')
    } catch (error) {
      console.error('Settings update error:', error)
      toast.error('Error updating settings: ' + (error.message || 'Unknown error'))
    }
  }

  if (loading) {
    return <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <SettingsIcon className="text-primary" size={32} />
        Settings
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Shield className="text-primary" size={24} />
            Security Settings
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('requireEmailVerification')}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Require Email Verification</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('requireKYC')}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Require KYC Before Activation</label>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <CheckCircle2 className="text-primary" size={24} />
            Auto-Verification Settings
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('autoVerifyBank')}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">
                Automatically Verify Bank Details
                <span className="block text-xs text-gray-400 mt-1">
                  When enabled, bank details will be automatically verified upon submission
                </span>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('autoVerifyKYC')}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">
                Automatically Verify KYC Documents
                <span className="block text-xs text-gray-400 mt-1">
                  When enabled, KYC documents will be automatically verified upon submission
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <DollarSign className="text-primary" size={24} />
            Payment & Wallet Settings
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('enablePayments')}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Enable Payments (off by default)</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('enableWalletCrediting')}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Enable Wallet Crediting Features (off by default)</label>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Search className="text-primary" size={24} />
            SEO Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Meta Title</label>
              <input
                type="text"
                {...register('seoTitle')}
                className="input-field"
                placeholder="Malaysian Trade Net - Investment Platform"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Meta Description</label>
              <textarea
                {...register('seoDescription')}
                className="input-field min-h-[100px]"
                placeholder="Meta description for SEO..."
              />
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary">
          Save Settings
        </button>
      </form>
    </div>
  )
}

