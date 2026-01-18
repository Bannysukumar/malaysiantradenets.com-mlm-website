import { Bell } from 'lucide-react'

export default function UserNotifications() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Notifications</h1>
      <div className="card">
        <div className="text-center py-12">
          <Bell className="text-gray-400 mx-auto mb-4" size={48} />
          <p className="text-gray-400">No notifications yet</p>
        </div>
      </div>
    </div>
  )
}

