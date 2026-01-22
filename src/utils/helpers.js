export function generateRefCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function formatCurrency(amount, currency = 'INR') {
  const locale = currency === 'INR' ? 'en-IN' : 'en-US'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatDate(date) {
  if (!date) return ''
  if (date.toDate) {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date.toDate())
  }
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export function clsx(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function getReferralLink(refCode) {
  const baseUrl = window.location.origin
  return `${baseUrl}/auth?ref=${refCode}`
}

export function getRefCodeFromUrl() {
  const params = new URLSearchParams(window.location.search)
  return params.get('ref')
}

