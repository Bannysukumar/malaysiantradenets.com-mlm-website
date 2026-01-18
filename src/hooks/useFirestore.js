import { useState, useEffect } from 'react'
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../config/firebase'

export function useFirestore(ref, options = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!ref) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() })
        } else {
          setData(null)
        }
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [ref])

  return { data, loading, error }
}

export function useCollection(collectionPath, queryConstraints = []) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(collection(db, collectionPath), ...queryConstraints)
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setData(items)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [collectionPath, JSON.stringify(queryConstraints)])

  return { data, loading, error }
}

