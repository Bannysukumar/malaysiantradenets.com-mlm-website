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
          const userDataFromFirestore = userDoc.data()
          
          // Also check if bank details exist in userFinancialProfiles
          const financialProfileDoc = await getDoc(doc(db, 'userFinancialProfiles', firebaseUser.uid))
          if (financialProfileDoc.exists() && financialProfileDoc.data().bank?.holderName) {
            // If bank details exist but flag is not set, update it
            if (!userDataFromFirestore.bankDetailsCompleted) {
              await updateDoc(doc(db, 'users', firebaseUser.uid), {
                bankDetailsCompleted: true
              })
              userDataFromFirestore.bankDetailsCompleted = true
            }
          }
          
          setUserData(userDataFromFirestore)
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

  const signUp = async (email, password, name, phone, refCode = null) => {
    try {
      // Registration is FREE - no payment required
      // Referral code is optional (only for hierarchy mapping, no income)
      
      let referredByUid = null
      let refCodeUsed = null
      
      // Optional referral code validation (only for mapping, not required)
      if (refCode && refCode.trim().length >= 4) {
        const usersSnapshot = await getDocs(query(collection(db, 'users'), where('refCode', '==', refCode.toUpperCase().trim())))
        if (!usersSnapshot.empty) {
          const referrerDoc = usersSnapshot.docs[0]
          const referrerData = referrerDoc.data()
          
          if (referrerData.status !== 'blocked' && referrerData.status !== 'AUTO_BLOCKED') {
            referredByUid = referrerDoc.id
            refCodeUsed = refCode.toUpperCase().trim()
          }
        }
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(userCredential.user, { displayName: name })
      
      // Generate ref code for new user
      const newRefCode = generateRefCode()
      
      const userId = userCredential.user.uid
      
      // Auto-activate Leader Program on signup
      // Get program config for Leader settings
      const programConfigDoc = await getDoc(doc(db, 'adminConfig', 'programs'))
      const programConfig = programConfigDoc.exists() ? programConfigDoc.data() : {
        leaderCapMultiplier: 3.0,
        leaderBaseAmount: 1000
      }
      
      const leaderBaseAmount = programConfig.leaderBaseAmount || 1000
      const leaderCapMultiplier = programConfig.leaderCapMultiplier || 3.0
      const leaderCapAmount = leaderBaseAmount * leaderCapMultiplier

      // Create user data with Leader program activated
      const userData = {
        name,
        email,
        phone: phone.replace(/[\s\-\(\)]/g, ''), // Clean phone number
        refCode: newRefCode,
        referredByUid: referredByUid, // Optional - only for hierarchy
        refCodeUsed: refCodeUsed, // Optional
        createdAt: serverTimestamp(),
        status: 'ACTIVE_LEADER', // Auto-activated as Leader
        role: 'user',
        programType: 'leader', // Auto-activated as Leader
        walletBalance: 0,
        pendingBalance: 0,
        lifetimeEarned: 0,
        lifetimeWithdrawn: 0,
        bankDetailsCompleted: false, // Must complete bank details
        activationDeadline: null, // Not needed for auto-activated Leader
      }
      
      await setDoc(doc(db, 'users', userId), userData)
      
      // Create user package for Leader
      const packageId = `leader_${userId}_${Date.now()}`
      await setDoc(doc(db, 'userPackages', packageId), {
        userId: userId,
        packageId: 'LEADER_PROGRAM',
        packageName: 'Leader Program',
        amount: 0, // Zero activation
        inrPrice: 0,
        status: 'active',
        activatedAt: serverTimestamp(),
        cycleNumber: 1,
        baseAmountInr: leaderBaseAmount,
        capMultiplier: leaderCapMultiplier,
        capAmountInr: leaderCapAmount,
        capStatus: 'ACTIVE',
        workingDaysProcessed: 0,
        totalROIEarned: 0
      })

      // Create earning cap tracker
      await setDoc(doc(db, 'earningCaps', `${userId}_1`), {
        uid: userId,
        cycleNumber: 1,
        baseAmountInr: leaderBaseAmount,
        capMultiplier: leaderCapMultiplier,
        capAmountInr: leaderCapAmount,
        eligibleEarningsTotalInr: 0,
        eligibleEarningsTotalUsd: 0,
        remainingInr: leaderCapAmount,
        capStatus: 'ACTIVE',
        lastUpdatedAt: serverTimestamp()
      })
      
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

