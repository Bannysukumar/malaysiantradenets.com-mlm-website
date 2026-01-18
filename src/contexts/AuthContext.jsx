import { createContext, useContext, useEffect, useState } from 'react'
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import { generateRefCode } from '../utils/helpers'
import toast from 'react-hot-toast'

const AuthContext = createContext()

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        // Fetch user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (userDoc.exists()) {
          setUserData(userDoc.data())
        } else {
          // Create user document if it doesn't exist
          const refCode = generateRefCode()
          const userData = {
            name: firebaseUser.displayName || '',
            email: firebaseUser.email,
            refCode,
            createdAt: serverTimestamp(),
            status: 'active',
            role: 'user',
          }
          await setDoc(doc(db, 'users', firebaseUser.uid), userData)
          setUserData(userData)
        }
      } else {
        setUser(null)
        setUserData(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const signIn = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      return userCredential.user
    } catch (error) {
      throw error
    }
  }

  const signUp = async (email, password, name, phone, refCode) => {
    try {
      if (!refCode || refCode.trim().length < 4) {
        throw new Error('Valid referral code is required')
      }

      // Validate referral code exists and is active
      const usersSnapshot = await getDocs(query(collection(db, 'users'), where('refCode', '==', refCode.toUpperCase().trim())))
      if (usersSnapshot.empty) {
        throw new Error('Referral code not found')
      }
      
      const referrerDoc = usersSnapshot.docs[0]
      const referrerData = referrerDoc.data()
      
      if (referrerData.status === 'blocked') {
        throw new Error('Referral code belongs to a blocked account')
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(userCredential.user, { displayName: name })
      
      // Generate ref code for new user
      const newRefCode = generateRefCode()
      
      const userData = {
        name,
        email,
        phone: phone.replace(/[\s\-\(\)]/g, ''), // Clean phone number
        refCode: newRefCode,
        referredByUid: referrerDoc.id,
        refCodeUsed: refCode.toUpperCase().trim(),
        createdAt: serverTimestamp(),
        status: 'active',
        role: 'user',
        walletBalance: 0,
        pendingBalance: 0,
        lifetimeEarned: 0,
        lifetimeWithdrawn: 0,
        directReferrals: 0,
      }
      
      await setDoc(doc(db, 'users', userCredential.user.uid), userData)
      
      // Update referrer's direct referrals count
      await setDoc(doc(db, 'users', referrerDoc.id), {
        directReferrals: (referrerData.directReferrals || 0) + 1
      }, { merge: true })
      
      // Send email verification
      await sendEmailVerification(userCredential.user)
      
      return userCredential.user
    } catch (error) {
      throw error
    }
  }

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider()
      const userCredential = await signInWithPopup(auth, provider)
      return userCredential.user
    } catch (error) {
      throw error
    }
  }

  const logout = async () => {
    try {
      await signOut(auth)
      toast.success('Logged out successfully')
    } catch (error) {
      toast.error('Error signing out')
    }
  }

  const isAdmin = userData?.role === 'admin' || userData?.role === 'superAdmin'
  const isSuperAdmin = userData?.role === 'superAdmin'

  const value = {
    user,
    userData,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    logout,
    isAdmin,
    isSuperAdmin,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

