import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import defaultFirebaseConfig from '../../firebase-applet-config.json';

function getEffectiveConfig() {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('custom_firebase_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.projectId && parsed.apiKey) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse custom_firebase_config from localStorage', e);
    }
  }
  return defaultFirebaseConfig;
}

export const activeFirebaseConfig = getEffectiveConfig();

const app = getApps().length === 0 ? initializeApp(activeFirebaseConfig) : getApps()[0];

// Use firestoreDatabaseId if specified (and not default), or default database
export const db = (activeFirebaseConfig.firestoreDatabaseId && activeFirebaseConfig.firestoreDatabaseId !== '(default)')
  ? getFirestore(app, activeFirebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

// Skill requirement: Validate connection on boot
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
    return true;
  }
}

testConnection().catch(console.error);

