# Step-by-Step: Sync Changes Across Tabs & Devices

This guide explains how to make changes appear automatically on other tabs and devices.

---

## Option A: Same Browser, Multiple Tabs

**Already working.** The app listens for changes. When you edit in Tab 1, Tab 2 will update automatically (after saving).

No setup needed.

---

## Option B: Different Devices (Phone, Laptop, etc.)

You need **Firebase** so all devices share the same database.

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add project** (or use an existing one)
3. Enter a name (e.g. `boarding-house`)
4. Follow the prompts (Analytics optional)

### Step 2: Add a Web App

1. In your Firebase project, click the **Web** icon `</>`
2. Register your app: enter a nickname (e.g. `boardinghouse-web`)
3. Click **Register app**
4. Copy the config object (or keep the page open)

### Step 3: Create Firestore Database

1. In the left sidebar: **Build** → **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (for development)
4. Pick a region near you
5. Click **Enable**

### Step 4: Get Your Firebase Config

1. Go to **Project Settings** (gear icon) → **General**
2. Scroll to **Your apps** and expand your web app
3. Copy these values:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

### Step 5: Add Env Vars Locally (.env.local)

Open `.env.local` and add or update:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### Step 6: Add the Same Env Vars on Vercel

1. Go to [vercel.com](https://vercel.com) and open your project
2. **Settings** → **Environment Variables**
3. Add each variable (name and value)
4. Choose **Production** and **Preview**
5. Click **Save**

### Step 7: Set Firestore Rules

1. In Firebase Console: **Firestore Database** → **Rules**
2. Use this for personal use:

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

3. Click **Publish**

### Step 8: Redeploy on Vercel

1. **Deployments** → latest deployment
2. Click **⋯** → **Redeploy**

---

## Verify It Works

1. Open the site on your laptop
2. Add or edit a bed/tenant and save
3. Open the site on your phone (or another device)
4. Changes should appear without refreshing

---

## Summary

| Setup | Same-browser tabs | Different devices |
|-------|-------------------|-------------------|
| No Firebase | ✅ (storage event) | ❌ |
| Firebase configured | ✅ (real-time) | ✅ (real-time) |
