import { useState } from 'react'
import { useCollection } from '../../hooks/useFirestore'
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Package, Plus, Trash2, Edit } from 'lucide-react'

export default function AdminPackages() {
  const { data: packages, loading } = useCollection('packages', [])
  const [editingId, setEditingId] = useState(null)
  const { register, handleSubmit, reset } = useForm()

  const onSubmit = async (data) => {
    try {
      const packageData = {
        ...data,
        usdPrice: parseFloat(data.usdPrice),
        inrPrice: parseFloat(data.inrPrice),
        order: parseInt(data.order) || 0,
        visibility: data.visibility || 'public',
      }
      if (editingId) {
        await updateDoc(doc(db, 'packages', editingId), packageData)
        toast.success('Package updated')
      } else {
        await addDoc(collection(db, 'packages'), packageData)
        toast.success('Package added')
      }
      reset()
      setEditingId(null)
    } catch (error) {
      toast.error('Error saving package')
    }
  }

  const handleEdit = (pkg) => {
    setEditingId(pkg.id)
    reset(pkg)
  }

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this package?')) {
      try {
        await deleteDoc(doc(db, 'packages', id))
        toast.success('Package deleted')
      } catch (error) {
        toast.error('Error deleting package')
      }
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <Package className="text-primary" size={32} />
        Packages Management
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Add/Edit Package</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                {...register('name', { required: true })}
                className="input-field"
                placeholder="Bronze"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">USD Price</label>
                <input
                  type="number"
                  step="0.01"
                  {...register('usdPrice', { required: true })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">INR Price</label>
                <input
                  type="number"
                  step="0.01"
                  {...register('inrPrice', { required: true })}
                  className="input-field"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Visibility</label>
              <select {...register('visibility')} className="input-field">
                <option value="public">Public</option>
                <option value="logged-in">Logged-in Only</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Order</label>
              <input
                type="number"
                {...register('order')}
                className="input-field"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Badge (optional)</label>
              <input
                type="text"
                {...register('badge')}
                className="input-field"
                placeholder="Popular"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('highlight')}
                className="w-4 h-4"
              />
              <label className="text-sm">Highlight Package</label>
            </div>
            <button type="submit" className="btn-primary w-full">
              {editingId ? 'Update Package' : 'Add Package'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => { reset(); setEditingId(null); }}
                className="btn-secondary w-full"
              >
                Cancel
              </button>
            )}
          </form>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">Packages List</h2>
          <div className="space-y-3">
            {packages.map((pkg) => (
              <div key={pkg.id} className="p-4 bg-dark-lighter rounded-lg flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-white">{pkg.name}</h3>
                  <p className="text-sm text-gray-400">
                    ${pkg.usdPrice} / ₹{pkg.inrPrice}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(pkg)}
                    className="p-2 text-primary hover:bg-dark rounded"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(pkg.id)}
                    className="p-2 text-red-500 hover:bg-dark rounded"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

