import { useState } from 'react'
import { useCollection } from '../../hooks/useFirestore'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { Wallet, Search, Plus, Minus } from 'lucide-react'
import { formatCurrency } from '../../utils/helpers'
import { useForm } from 'react-hook-form'

export default function AdminWallets() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [adjustmentType, setAdjustmentType] = useState('credit')
  
  const { data: users, loading } = useCollection('users', [])
  const { data: wallets } = useCollection('wallets', [])

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      user.name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.refCode?.toLowerCase().includes(search) ||
      user.uid?.toLowerCase().includes(search)
    )
  })

  const getUserWallet = (userId) => {
    const wallet = wallets.find(w => w.id === userId)
    if (wallet) return wallet
    const user = users.find(u => u.uid === userId || u.id === userId)
    return {
      id: userId,
      availableBalance: user?.walletBalance || 0,
      pendingBalance: user?.pendingBalance || 0,
      lifetimeEarned: user?.lifetimeEarned || 0,
      lifetimeWithdrawn: user?.lifetimeWithdrawn || 0,
    }
  }

  const adjustmentForm = useForm()

  const handleAdjustment = async (data) => {
    try {
      const amount = parseFloat(data.amount)
      if (amount <= 0) {
        toast.error('Amount must be greater than 0')
        return
      }

      if (!data.reason.trim()) {
        toast.error('Reason is required')
        return
      }

      // Create adjustment via Cloud Function (server-side)
      const { httpsCallable } = await import('firebase/functions')
      const { functions } = await import('../../config/firebase')
      const adjustWallet = httpsCallable(functions, 'adjustUserWallet')
      
      const result = await adjustWallet({
        userId: selectedUser.id || selectedUser.uid,
        amount: adjustmentType === 'credit' ? amount : -amount,
        type: 'admin_adjust',
        description: data.reason,
        adminNote: data.adminNote || ''
      })

      if (result.data.success) {
        toast.success(`Wallet ${adjustmentType === 'credit' ? 'credited' : 'debited'} successfully`)
        setSelectedUser(null)
        adjustmentForm.reset()
      } else {
        toast.error(result.data.error || 'Error adjusting wallet')
      }
    } catch (error) {
      console.error('Adjustment error:', error)
      toast.error(error.message || 'Error adjusting wallet')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <Wallet className="text-primary" size={32} />
        Wallet Management
      </h1>

      <div className="card mb-6">
        <div className="flex items-center gap-2">
          <Search className="text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search users by name, email, or referral code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field flex-1"
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-4 px-4 font-semibold">User</th>
              <th className="text-left py-4 px-4 font-semibold">Available</th>
              <th className="text-left py-4 px-4 font-semibold">Pending</th>
              <th className="text-left py-4 px-4 font-semibold">Total Earned</th>
              <th className="text-left py-4 px-4 font-semibold">Total Withdrawn</th>
              <th className="text-left py-4 px-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-gray-400">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const wallet = getUserWallet(user.uid || user.id)
                return (
                  <tr key={user.id} className="border-b border-gray-800 hover:bg-dark-lighter">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-semibold">{user.name || 'N/A'}</p>
                        <p className="text-sm text-gray-400">{user.email}</p>
                        <p className="text-xs text-gray-500 font-mono">{user.refCode}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-semibold text-primary">
                      {formatCurrency(wallet.availableBalance || 0, 'INR')}
                    </td>
                    <td className="py-4 px-4 text-yellow-500">
                      {formatCurrency(wallet.pendingBalance || 0, 'INR')}
                    </td>
                    <td className="py-4 px-4 text-green-500">
                      {formatCurrency(wallet.lifetimeEarned || 0, 'INR')}
                    </td>
                    <td className="py-4 px-4 text-gray-400">
                      {formatCurrency(wallet.lifetimeWithdrawn || 0, 'INR')}
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="text-primary hover:underline text-sm"
                      >
                        Adjust Wallet
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Adjust Wallet</h2>
              <button
                onClick={() => {
                  setSelectedUser(null)
                  adjustmentForm.reset()
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-400">User: {selectedUser.name}</p>
              <p className="text-sm text-gray-400">Current Balance: {formatCurrency(getUserWallet(selectedUser.uid || selectedUser.id).availableBalance, 'INR')}</p>
            </div>

            <form onSubmit={adjustmentForm.handleSubmit(handleAdjustment)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Adjustment Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('credit')}
                    className={`flex-1 py-2 rounded-lg ${
                      adjustmentType === 'credit'
                        ? 'bg-green-500 text-white'
                        : 'bg-dark-lighter text-gray-300'
                    }`}
                  >
                    <Plus size={20} className="mx-auto" />
                    Credit
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('debit')}
                    className={`flex-1 py-2 rounded-lg ${
                      adjustmentType === 'debit'
                        ? 'bg-red-500 text-white'
                        : 'bg-dark-lighter text-gray-300'
                    }`}
                  >
                    <Minus size={20} className="mx-auto" />
                    Debit
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  {...adjustmentForm.register('amount', { required: 'Amount is required', min: 0.01 })}
                  className="input-field"
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Reason <span className="text-red-500">*</span></label>
                <textarea
                  {...adjustmentForm.register('reason', { required: 'Reason is required' })}
                  className="input-field min-h-[100px]"
                  placeholder="Enter reason for adjustment..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Admin Note (Optional)</label>
                <textarea
                  {...adjustmentForm.register('adminNote')}
                  className="input-field min-h-[80px]"
                  placeholder="Internal notes..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null)
                    adjustmentForm.reset()
                  }}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary"
                >
                  {adjustmentType === 'credit' ? 'Credit' : 'Debit'} Wallet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

