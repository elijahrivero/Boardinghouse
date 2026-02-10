# Boarding House Website

A simple, personal-use boarding house site with bed availability, tenant balance, and an admin page.

## Features

- **Bed Spaces** — Room/bed availability with tenant details per bed. Public users can click beds to **view** details only. Real-time updates via Firebase.
- **Tenant Balance** — Monthly rent, amount paid, remaining balance, status (Paid, Due Soon, Overdue). Public users can view and search; **edit/delete only in Admin**.
- **Admin** (`/admin`) — Login with credentials from env. Full edit/delete for bed spaces and tenant balance.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Firebase (Bed Spaces)

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Add a web app and copy the config values
3. Create Firestore database
4. Add a `beds` collection. Each document:

   ```
   house: "1" | "2"
   roomNumber: "1" | "2" | "3" | "4"
   bedNumber: "A" | "B" | "C" | ...
   status: "available" | "occupied"
   tenantName: string (optional)
   tenantPhone: string (optional)
   moveInDate: string (optional)
   notes: string (optional)
   ```

5. Set Firestore rules. For personal use, allow read/write:

   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /beds/{document=**} {
         allow read, write: if true;  // Personal use only; restrict in production
       }
     }
   }
   ```

### 3. Google Sheets (Tenant Balance)

1. Create a Google Sheet with a **TenantBalance** tab:
   - Columns: `Tenant Name | Room | Bed | Monthly Rent | Amount Paid | Remaining Balance | Status`

2. Enable [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
3. Create a Service Account (IAM & Admin → Service Accounts), download JSON key
4. Share the Sheet with the service account email (Editor access)
5. Put the JSON key content in `GOOGLE_SHEETS_CREDENTIALS` (as a single-line string)

### 4. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Admin credentials (required for /admin login)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me

# Google Sheets (optional, for Tenant Balance from Sheets)
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}  # Single line
GOOGLE_SHEET_ID=your_spreadsheet_id
```

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Admin page: [http://localhost:3000/admin](http://localhost:3000/admin).
