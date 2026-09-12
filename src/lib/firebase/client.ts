import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'account-ten-my-id.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'account-ten-my-id',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'account-ten-my-id.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789012',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123456789012:web:demo',
};

// Check if Firebase config is configured with actual credentials
export const isFirebaseConfigured = (): boolean => {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  return Boolean(key && !key.includes('DemoKey') && key !== 'demo-api-key');
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.warn('Firebase initialization notice:', error);
  // Fallback initialization
  app = !getApps().length ? initializeApp(firebaseConfig, 'SSO_FALLBACK') : getApp('SSO_FALLBACK');
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };
