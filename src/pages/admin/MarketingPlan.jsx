import { useFirestore } from '../../hooks/useFirestore'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { TrendingUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

export default function AdminMarketingPlan() {
  const { data: marketingConfig, loading } = useFirestore(doc(db, 'marketingConfig', 'main'))
  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: marketingConfig || {
      directReferralPercent: 5,
      levelPercentages: [],
      qualificationRules: '',
    },
  })

  const levelPercentages = watch('levelPercentages') || []

  const onSubmit = async (data) => {
    try {
      await setDoc(doc(db, 'marketingConfig', 'main'), {
        ...data,
        directReferralPercent: parseFloat(data.directReferralPercent),
        levelPercentages: data.levelPercentages ? data.levelPercentages.map(l => ({
          levelFrom: parseInt(l.levelFrom),
          levelTo: parseInt(l.levelTo),
          percent: parseFloat(l.percent),
        })) : [],
      }, { merge: true })
      toast.success('Marketing plan updated')
    } catch (error) {
      console.error('Marketing plan update error:', error)
      toast.error('Error updating marketing plan: ' + (error.message || 'Unknown error'))
    }
  }

  const addLevel = () => {
    const newLevels = [...levelPercentages, { levelFrom: '', levelTo: '', percent: '' }]
    setValue('levelPercentages', newLevels)
  }

  const removeLevel = (index) => {
    const newLevels = levelPercentages.filter((_, i) => i !== index)
    setValue('levelPercentages', newLevels)
  }

  if (loading) {
    return <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <TrendingUp className="text-primary" size={32} />
        Marketing Plan Configuration
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Direct Referral</h2>
          <div>
            <label className="block text-sm font-medium mb-2">Direct Referral Percentage</label>
            <input
              type="number"
              step="0.1"
              {...register('directReferralPercent', { required: true })}
              className="input-field"
            />
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Level Percentages</h2>
            <button
              type="button"
              onClick={addLevel}
              className="btn-secondary flex items-center gap-2"
            >
              <Plus size={18} />
              Add Level
            </button>
          </div>
          <div className="space-y-4">
            {levelPercentages.map((level, index) => (
              <div key={index} className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">Level From</label>
                  <input
                    type="number"
                    {...register(`levelPercentages.${index}.levelFrom`, { required: true })}
                    className="input-field"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">Level To</label>
                  <input
                    type="number"
                    {...register(`levelPercentages.${index}.levelTo`, { required: true })}
                    className="input-field"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">Percentage</label>
                  <input
                    type="number"
                    step="0.1"
                    {...register(`levelPercentages.${index}.percent`, { required: true })}
                    className="input-field"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLevel(index)}
                  className="p-2 text-red-500 hover:bg-dark-lighter rounded"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">Qualification Rules</h2>
          <textarea
            {...register('qualificationRules')}
            className="input-field min-h-[200px]"
            placeholder="Enter qualification rules..."
          />
        </div>

        <button type="submit" className="btn-primary">
          Save Changes
        </button>
      </form>
    </div>
  )
}

