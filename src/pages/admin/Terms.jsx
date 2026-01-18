import { useFirestore } from '../../hooks/useFirestore'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { FileCheck } from 'lucide-react'

export default function AdminTerms() {
  const { data: terms, loading } = useFirestore(doc(db, 'terms', 'main'))
  const { register, handleSubmit } = useForm({
    defaultValues: terms || {
      content: '',
      requireAcceptance: false,
      adminChargesPercent: 10,
      payoutSchedule: '',
    },
  })

  const onSubmit = async (data) => {
    try {
      await setDoc(doc(db, 'terms', 'main'), {
        content: data.content,
        requireAcceptance: data.requireAcceptance === true || data.requireAcceptance === 'true',
        adminChargesPercent: parseFloat(data.adminChargesPercent),
        payoutSchedule: data.payoutSchedule,
      }, { merge: true })
      toast.success('Terms updated successfully')
    } catch (error) {
      console.error('Terms update error:', error)
      toast.error('Error updating terms: ' + (error.message || 'Unknown error'))
    }
  }

  if (loading) {
    return <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <FileCheck className="text-primary" size={32} />
        Terms & Conditions
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Terms Content</label>
          <textarea
            {...register('content')}
            className="input-field min-h-[400px]"
            placeholder="Enter terms and conditions..."
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register('requireAcceptance')}
            className="w-4 h-4"
          />
          <label className="text-sm font-medium">Require acceptance on signup</label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Admin Charges Percentage</label>
          <input
            type="number"
            step="0.1"
            {...register('adminChargesPercent')}
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Payout Schedule (e.g., Mon-Fri, cutoff Fri, release Mon)</label>
          <textarea
            {...register('payoutSchedule')}
            className="input-field min-h-[100px]"
            placeholder="Payout schedule details..."
          />
        </div>

        <button type="submit" className="btn-primary">
          Save Changes
        </button>
      </form>
    </div>
  )
}

