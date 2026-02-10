# Firebase Setup Guide

Follow these steps to configure Firebase for your boarding house app.

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add project** (or use an existing project)
3. Enter a project name (e.g. "boardinghouse") and continue
4. Disable Google Analytics if you don't need it (optional)
5. Click **Create project**

## 2. Create Firestore Database

1. In your Firebase project, go to **Build** → **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (for development) or **Production mode**
4. Select a location (e.g. `us-central1`) and click **Enable**

### Firestore Rules (for bed data)

In Firestore → **Rules**, use:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /beds/{document=**} {
      allow read, write: if true;
    }
  }
}
```

> **Note:** This allows anyone to read/write. For production, add authentication.

## 3. Register Your Web App

1. In Firebase Console, click the **Web** icon (`</>`) to add an app
2. Enter an app nickname (e.g. "Boarding House Web")
3. Don't check "Firebase Hosting" unless you need it
4. Click **Register app**
5. Copy the `firebaseConfig` object — you'll need these values

## 4. Add Config to .env.local

1. In your project root, copy `.env.example` to `.env.local`:

   ```bash
   copy .env.example .env.local
   ```

2. Open `.env.local` and fill in the Firebase values:

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
   ```

   Get each value from the `firebaseConfig` object in the Firebase Console.

## 5. Restart the Dev Server

```bash
npm run dev
```

After restarting, the app will use Firebase instead of localStorage for bed data. Your data will sync across devices and persist in the cloud.
