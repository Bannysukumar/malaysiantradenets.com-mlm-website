import { useState } from 'react'
import { useCollection } from '../../hooks/useFirestore'
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { Briefcase, Plus, Trash2, Edit } from 'lucide-react'

export default function AdminServices() {
  const { data: services, loading } = useCollection('services', [])
  const [editingId, setEditingId] = useState(null)
  const { register, handleSubmit, reset } = useForm()

  const onSubmit = async (data) => {
    try {
      if (editingId) {
        await updateDoc(doc(db, 'services', editingId), data)
        toast.success('Service updated')
      } else {
        await addDoc(collection(db, 'services'), data)
        toast.success('Service added')
      }
      reset()
      setEditingId(null)
    } catch (error) {
      toast.error('Error saving service')
    }
  }

  const handleEdit = (service) => {
    setEditingId(service.id)
    reset(service)
  }

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this service?')) {
      try {
        await deleteDoc(doc(db, 'services', id))
        toast.success('Service deleted')
      } catch (error) {
        toast.error('Error deleting service')
      }
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <Briefcase className="text-primary" size={32} />
        Services Management
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Add/Edit Service</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                {...register('name', { required: true })}
                className="input-field"
                placeholder="Forex Trading"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                {...register('description', { required: true })}
                className="input-field min-h-[100px]"
                placeholder="Service description..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Icon (icon name from lucide-react)</label>
              <input
                type="text"
                {...register('icon', { required: true })}
                className="input-field"
                placeholder="TrendingUp"
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              {editingId ? 'Update Service' : 'Add Service'}
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
          <h2 className="text-xl font-bold mb-4">Services List</h2>
          <div className="space-y-3">
            {services.map((service) => (
              <div key={service.id} className="p-4 bg-dark-lighter rounded-lg flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-white">{service.name}</h3>
                  <p className="text-sm text-gray-400">{service.description}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(service)}
                    className="p-2 text-primary hover:bg-dark rounded"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(service.id)}
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

