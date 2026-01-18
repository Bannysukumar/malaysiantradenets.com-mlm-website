// IFSC Code Lookup API
// Using free IFSC API: https://ifsc.razorpay.com/

export async function fetchIFSCDetails(ifscCode) {
  try {
    const response = await fetch(`https://ifsc.razorpay.com/${ifscCode.toUpperCase()}`)
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('IFSC code not found')
      }
      throw new Error('Failed to fetch IFSC details')
    }
    
    const data = await response.json()
    
    if (data.ERROR) {
      throw new Error(data.ERROR)
    }
    
    return {
      bank: data.BANK || '',
      branch: data.BRANCH || '',
      address: data.ADDRESS || '',
      city: data.CITY || '',
      district: data.DISTRICT || '',
      state: data.STATE || '',
      ifsc: data.IFSC || ifscCode.toUpperCase(),
      micr: data.MICR || '',
      contact: data.CONTACT || '',
      valid: true
    }
  } catch (error) {
    console.error('IFSC API Error:', error)
    return {
      valid: false,
      error: error.message || 'Failed to fetch bank details'
    }
  }
}

