/**
 * Generate a deterministic avatar URL based on user ID
 * Uses a service that generates realistic avatars
 */

export function getAvatarUrl(user, size = 80) {
  // Priority 1: User uploaded avatar
  if (user?.avatarUrl) {
    return user.avatarUrl
  }

  // Priority 2: Generate deterministic realistic avatar
  // Using DiceBear API with a seed based on userId or email
  const seed = user?.userId || user?.email || user?.uid || 'default'
  
  // Using "avataaars" style for realistic avatars
  // You can also use "personas", "adventurer", "big-smile" for different styles
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&size=${size}`
}

/**
 * Generate initials from name
 */
export function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

/**
 * Get avatar component props
 */
export function getAvatarProps(user, size = 80) {
  const avatarUrl = getAvatarUrl(user, size)
  const initials = getInitials(user?.name)
  const name = user?.name || 'User'
  
  return {
    avatarUrl,
    initials,
    name,
    size
  }
}

