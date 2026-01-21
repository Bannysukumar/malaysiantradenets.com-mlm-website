// Validation utilities

export function validateName(name) {
  if (!name || name.trim().length < 2) {
    return 'Name must be at least 2 characters'
  }
  return null
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !emailRegex.test(email)) {
    return 'Please enter a valid email address'
  }
  return null
}

export function validatePhone(phone, requireCountryCode = false) {
  if (!phone) {
    return 'Phone number is required'
  }
  
  // Remove spaces and special characters
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')
  
  // Check if it's E.164 format (starts with +)
  if (cleaned.startsWith('+')) {
    if (cleaned.length < 10 || cleaned.length > 15) {
      return 'Invalid phone number format'
    }
    return null
  }
  
  // Indian format: 10 digits
  if (/^\d{10}$/.test(cleaned)) {
    return null
  }
  
  return 'Phone number must be 10 digits (or include country code)'
}

export function validatePassword(password, config = {}) {
  const {
    minLength = 8,
    requireUppercase = true,
    requireNumber = true,
    requireSpecialChar = false
  } = config
  
  if (!password) {
    return 'Password is required'
  }
  
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters`
  }
  
  if (requireUppercase && !/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter'
  }
  
  if (requireNumber && !/\d/.test(password)) {
    return 'Password must contain at least one number'
  }
  
  if (requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return 'Password must contain at least one special character'
  }
  
  return null
}

export function validateConfirmPassword(password, confirmPassword) {
  if (!confirmPassword) {
    return 'Please confirm your password'
  }
  
  if (password !== confirmPassword) {
    return 'Passwords do not match'
  }
  
  return null
}

export function validateReferralCode(refCode) {
  if (!refCode || refCode.trim().length === 0) {
    return 'Referral code is required'
  }
  
  if (refCode.trim().length < 4) {
    return 'Invalid referral code format'
  }
  
  return null
}

export function validateIFSC(ifsc) {
  if (!ifsc) {
    return 'IFSC code is required'
  }
  
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/
  if (!ifscRegex.test(ifsc.toUpperCase())) {
    return 'Invalid IFSC code format (e.g., SBIN0001234)'
  }
  
  return null
}

export function validateAccountNumber(accountNumber, confirmAccountNumber) {
  if (!accountNumber) {
    return 'Account number is required'
  }
  
  if (!/^\d{9,18}$/.test(accountNumber)) {
    return 'Account number must be 9-18 digits'
  }
  
  if (confirmAccountNumber && accountNumber !== confirmAccountNumber) {
    return 'Account numbers do not match'
  }
  
  return null
}

export function validateUPI(upiId) {
  if (!upiId) {
    return 'UPI ID is required'
  }
  
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/
  if (!upiRegex.test(upiId)) {
    return 'Invalid UPI ID format (e.g., name@bank)'
  }
  
  return null
}

export function validateWithdrawalAmount(amount, minAmount, maxAmount) {
  if (!amount || amount <= 0) {
    return 'Amount must be greater than 0'
  }
  
  if (minAmount && amount < minAmount) {
    return `Minimum withdrawal amount is ${minAmount}`
  }
  
  if (maxAmount && amount > maxAmount) {
    return `Maximum withdrawal amount is ${maxAmount}`
  }
  
  return null
}

export function validatePAN(pan) {
  if (!pan) {
    return 'PAN card number is required'
  }
  
  // PAN format: ABCDE1234F (5 letters, 4 digits, 1 letter)
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
  if (!panRegex.test(pan.toUpperCase())) {
    return 'Invalid PAN card format (e.g., ABCDE1234F)'
  }
  
  return null
}

