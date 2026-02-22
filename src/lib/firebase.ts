import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const hasValidConfig = 
  firebaseConfig.projectId &&
  firebaseConfig.apiKey &&
  typeof firebaseConfig.projectId === "string" &&
  typeof firebaseConfig.apiKey === "string";

let db: Firestore | null = null;
let isOfflineMode = false;

// Initialize Firebase immediately
if (hasValidConfig) {
  try {
    let app: FirebaseApp;
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      console.log("Firebase app initialized");
    } else {
      app = getApps()[0] as FirebaseApp;
      console.log("Using existing Firebase app");
    }
    db = getFirestore(app);
    console.log("Firebase Firestore initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
    isOfflineMode = true;
    db = null;
  }
} else {
  console.warn("Firebase configuration is incomplete. Missing:", {
    projectId: !!firebaseConfig.projectId,
    apiKey: !!firebaseConfig.apiKey,
    authDomain: !!firebaseConfig.authDomain,
    storageBucket: !!firebaseConfig.storageBucket,
    messagingSenderId: !!firebaseConfig.messagingSenderId,
    appId: !!firebaseConfig.appId
  });
  isOfflineMode = true;
}

export function initializeFirebase() {
  return db;
}

export function getFirebaseStatus() {
  return {
    isConfigured: hasValidConfig,
    isOffline: isOfflineMode,
    db
  };
}

export { db };
