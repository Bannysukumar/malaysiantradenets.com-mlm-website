import { useForm } from 'react-hook-form'
import { HelpCircle, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../config/firebase'

export default function UserSupport() {
  const { user } = useAuth()
  const { register, handleSubmit, reset } = useForm()

  const onSubmit = async (data) => {
    try {
      await addDoc(collection(db, 'supportTickets'), {
        userId: user.uid,
        email: user.email,
        subject: data.subject,
        message: data.message,
        status: 'open',
        createdAt: serverTimestamp(),
      })
      toast.success('Support ticket submitted successfully')
      reset()
    } catch (error) {
      toast.error('Error submitting ticket')
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Support</h1>

      <div className="card max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <HelpCircle className="text-primary" size={24} />
          <h2 className="text-xl font-bold">Contact Support</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Subject</label>
            <input
              type="text"
              {...register('subject', { required: 'Subject is required' })}
              className="input-field"
              placeholder="What can we help you with?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Message</label>
            <textarea
              {...register('message', { required: 'Message is required' })}
              className="input-field min-h-[200px]"
              placeholder="Describe your issue or question..."
            />
          </div>

          <button type="submit" className="btn-primary flex items-center gap-2">
            <Send size={20} />
            Submit Ticket
          </button>
        </form>
      </div>
    </div>
  )
}

