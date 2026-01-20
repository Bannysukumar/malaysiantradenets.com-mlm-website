import { useForm } from 'react-hook-form'
import { HelpCircle, Send, MessageCircle, Mail, Clock, CheckCircle, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { collection, addDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useCollection } from '../../hooks/useFirestore'
import { formatDate } from '../../utils/helpers'

export default function UserSupport() {
  const { user } = useAuth()
  const { register, handleSubmit, reset } = useForm()

  // Get user's support tickets
  const { data: tickets, loading } = useCollection(
    'supportTickets',
    user?.uid ? [
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    ] : []
  )

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
      console.error('Error submitting ticket:', error)
      toast.error('Error submitting ticket')
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      open: { bg: 'bg-yellow-500', label: 'Open' },
      in_progress: { bg: 'bg-blue-500', label: 'In Progress' },
      resolved: { bg: 'bg-green-500', label: 'Resolved' },
      closed: { bg: 'bg-gray-500', label: 'Closed' },
    }
    const statusInfo = statusMap[status] || { bg: 'bg-gray-500', label: status }
    return <span className={`badge ${statusInfo.bg}`}>{statusInfo.label}</span>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent flex items-center gap-3">
          <HelpCircle className="text-primary" size={36} />
          Support Center
        </h1>
        <p className="text-gray-400">Get help with your account and transactions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Support Form */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary/10 rounded-xl">
                <MessageCircle className="text-primary" size={24} />
              </div>
              <h2 className="text-xl font-bold">Submit a Support Ticket</h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('subject', { required: 'Subject is required' })}
                  className="input-field"
                  placeholder="What can we help you with?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register('message', { required: 'Message is required' })}
                  className="input-field min-h-[200px]"
                  placeholder="Describe your issue or question in detail..."
                />
              </div>

              <button type="submit" className="w-full btn-primary flex items-center justify-center gap-2 py-3">
                <Send size={20} />
                Submit Ticket
              </button>
            </form>
          </div>
        </div>

        {/* Information Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Info className="text-primary" size={20} />
              Support Information
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Clock className="text-primary flex-shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-white font-medium">Response Time</p>
                  <p className="text-gray-400">We typically respond within 24-48 hours</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="text-primary flex-shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-white font-medium">Email Updates</p>
                  <p className="text-gray-400">You'll receive updates at {user?.email}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
            <h3 className="font-semibold text-white mb-2">Common Questions</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>• How to activate a package?</li>
              <li>• How to withdraw funds?</li>
              <li>• How to update bank details?</li>
              <li>• How to view referral income?</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Support Tickets History */}
      {tickets && tickets.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <MessageCircle className="text-primary" size={24} />
            Your Support Tickets
          </h2>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-3"></div>
              <p className="text-gray-400">Loading tickets...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="p-4 bg-dark-lighter rounded-lg border border-gray-800 hover:border-gray-700 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">{ticket.subject}</h3>
                      <p className="text-sm text-gray-400 line-clamp-2">{ticket.message}</p>
                    </div>
                    <div className="ml-4">
                      {getStatusBadge(ticket.status)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{ticket.createdAt ? formatDate(ticket.createdAt) : 'N/A'}</span>
                    {ticket.adminResponse && (
                      <span className="text-primary flex items-center gap-1">
                        <CheckCircle size={14} />
                        Replied
                      </span>
                    )}
                  </div>
                  {ticket.adminResponse && (
                    <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-xs text-gray-400 mb-1">Admin Response:</p>
                      <p className="text-sm text-gray-300">{ticket.adminResponse}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
