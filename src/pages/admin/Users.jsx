import { useCollection } from '../../hooks/useFirestore'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import toast from 'react-hot-toast'
import { Users, Search, Shield, Ban } from 'lucide-react'
import { useState } from 'react'
import { formatDate } from '../../utils/helpers'

export default function AdminUsers() {
  const { data: users, loading, error } = useCollection('users', [])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.refCode?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole })
      toast.success('User role updated')
    } catch (error) {
      toast.error('Error updating user role')
    }
  }

  const handleStatusChange = async (userId, newStatus) => {
    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus })
      toast.success('User status updated')
    } catch (error) {
      toast.error('Error updating user status')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
          <Users className="text-primary" size={32} />
          User Management
        </h1>
        <div className="card">
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">Error loading users: {error?.message || 'Unknown error'}</p>
            <p className="text-gray-400 text-sm">Please check your Firebase connection and Firestore rules.</p>
            <p className="text-gray-500 text-xs mt-2">Error details: {String(error)}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <Users className="text-primary" size={32} />
        User Management
        <span className="text-lg text-gray-400 font-normal ml-2">({users.length} total)</span>
      </h1>

      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search users by name, email, or referral code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      {users.length === 0 ? (
        <div className="card">
          <div className="text-center py-12">
            <Users className="text-gray-400 mx-auto mb-4" size={48} />
            <p className="text-gray-400 text-lg mb-2">No users found</p>
            <p className="text-gray-500 text-sm">
              Users will appear here once they sign up through the registration page.
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Make sure users are signing up at <code className="bg-dark-lighter px-2 py-1 rounded">/auth</code>
            </p>
          </div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="card">
          <div className="text-center py-12">
            <Search className="text-gray-400 mx-auto mb-4" size={48} />
            <p className="text-gray-400 text-lg mb-2">No users match your search</p>
            <p className="text-gray-500 text-sm">
              Try a different search term or clear the search to see all {users.length} users.
            </p>
          </div>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-4 px-4 font-semibold">Name</th>
                <th className="text-left py-4 px-4 font-semibold">Email</th>
                <th className="text-left py-4 px-4 font-semibold">Ref Code</th>
                <th className="text-left py-4 px-4 font-semibold">Role</th>
                <th className="text-left py-4 px-4 font-semibold">Status</th>
                <th className="text-left py-4 px-4 font-semibold">Joined</th>
                <th className="text-left py-4 px-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
              <tr key={user.id} className="border-b border-gray-800 hover:bg-dark-lighter">
                <td className="py-4 px-4">{user.name || 'N/A'}</td>
                <td className="py-4 px-4">{user.email}</td>
                <td className="py-4 px-4 font-mono text-sm">{user.refCode}</td>
                <td className="py-4 px-4">
                  <select
                    value={user.role || 'user'}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="bg-dark-lighter border border-gray-700 rounded px-2 py-1 text-sm"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="superAdmin">Super Admin</option>
                  </select>
                </td>
                <td className="py-4 px-4">
                  <select
                    value={user.status || 'active'}
                    onChange={(e) => handleStatusChange(user.id, e.target.value)}
                    className="bg-dark-lighter border border-gray-700 rounded px-2 py-1 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </td>
                <td className="py-4 px-4 text-sm text-gray-400">
                  {user.createdAt ? formatDate(user.createdAt) : 'N/A'}
                </td>
                <td className="py-4 px-4">
                  <button
                    onClick={() => setSelectedUser(user)}
                    className="text-primary hover:underline text-sm"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}

