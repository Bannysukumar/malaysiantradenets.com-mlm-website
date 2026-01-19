import { useFirestore } from '../../hooks/useFirestore'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { DollarSign } from 'lucide-react'

export default function AdminIncomeRules() {
  const { data: incomeRules, loading } = useFirestore(doc(db, 'incomeRules', 'main'))
  const { register, handleSubmit } = useForm({
    defaultValues: incomeRules || {
      withSecurity: {
        minPackageInr: 50000,
        dailyPercent: 0.5,
        maxWorkingDays: 421,
        note: 'With Security: 0.5% daily, up to 421 working days (Monday to Friday)',
      },
      withoutSecurity: {
        dailyPercent: 1.0,
        maxWorkingDays: 221,
        note: 'Without Security: 1% daily, up to 221 working days (Monday to Friday)',
      },
    },
  })

  const onSubmit = async (data) => {
    try {
      await setDoc(doc(db, 'incomeRules', 'main'), {
        withSecurity: {
          minPackageInr: parseFloat(data.withSecurityMinPackageInr),
          dailyPercent: parseFloat(data.withSecurityDailyPercent),
          maxWorkingDays: parseInt(data.withSecurityMaxWorkingDays),
          note: data.withSecurityNote,
        },
        withoutSecurity: {
          dailyPercent: parseFloat(data.withoutSecurityDailyPercent),
          maxWorkingDays: parseInt(data.withoutSecurityMaxWorkingDays),
          note: data.withoutSecurityNote || '',
        },
      }, { merge: true })
      toast.success('Income rules updated')
    } catch (error) {
      console.error('Income rules update error:', error)
      toast.error('Error updating income rules: ' + (error.message || 'Unknown error'))
    }
  }

  if (loading) {
    return <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <DollarSign className="text-primary" size={32} />
        Income Rules Configuration
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">With Security</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Minimum Package (INR)</label>
              <input
                type="number"
                {...register('withSecurityMinPackageInr', { required: true })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Daily Percentage</label>
              <input
                type="number"
                step="0.1"
                {...register('withSecurityDailyPercent', { required: true })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Maximum Working Days</label>
              <input
                type="number"
                {...register('withSecurityMaxWorkingDays', { required: true })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Note</label>
              <textarea
                {...register('withSecurityNote')}
                className="input-field min-h-[100px]"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">Without Security</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Daily Percentage</label>
              <input
                type="number"
                step="0.1"
                {...register('withoutSecurityDailyPercent', { required: true })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Maximum Working Days</label>
              <input
                type="number"
                {...register('withoutSecurityMaxWorkingDays', { required: true })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Note (optional)</label>
              <textarea
                {...register('withoutSecurityNote')}
                className="input-field min-h-[100px]"
              />
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary">
          Save Changes
        </button>
      </form>
    </div>
  )
}

