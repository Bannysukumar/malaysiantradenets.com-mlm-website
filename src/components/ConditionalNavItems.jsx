import { useFirestore } from '../hooks/useFirestore'
import { doc } from 'firebase/firestore'
import { db } from '../config/firebase'

export function useFeatureConfig() {
  const { data: featureConfig } = useFirestore(doc(db, 'adminConfig', 'features'))
  return featureConfig || {}
}

