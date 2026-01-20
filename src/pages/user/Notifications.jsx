import { Bell, CheckCircle, AlertCircle, Info, X } from 'lucide-react'
import { formatDate } from '../../utils/helpers'

export default function UserNotifications() {
  // TODO: Implement notifications from Firestore
  const notifications = []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent flex items-center gap-3">
          <Bell className="text-primary" size={36} />
          Notifications
        </h1>
        <p className="text-gray-400">Stay updated with your account activities</p>
      </div>

      {notifications.length === 0 ? (
        <div className="card">
          <div className="text-center py-16">
            <div className="p-4 bg-primary/10 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <Bell className="text-primary" size={48} />
            </div>
            <p className="text-gray-400 text-lg mb-2">No notifications yet</p>
            <p className="text-gray-500 text-sm">You'll see important updates and alerts here</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => {
            const getIcon = () => {
              switch (notification.type) {
                case 'success':
                  return <CheckCircle className="text-green-500" size={20} />
                case 'warning':
                  return <AlertCircle className="text-yellow-500" size={20} />
                case 'error':
                  return <X className="text-red-500" size={20} />
                default:
                  return <Info className="text-primary" size={20} />
              }
            }

            return (
              <div
                key={notification.id}
                className={`card ${
                  !notification.read ? 'border-primary/50 bg-primary/5' : ''
                } hover:border-primary transition-all`}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-dark-lighter rounded-lg flex-shrink-0">
                    {getIcon()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-semibold text-white">{notification.title}</h3>
                      {!notification.read && (
                        <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2"></span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mb-2">{notification.message}</p>
                    <p className="text-gray-500 text-xs">{formatDate(notification.createdAt)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
