# Boarding House Website

A simple, personal-use boarding house site with bed availability, tenant balance, parcel status, and a hidden admin page with embedded Google Forms.

## Features

- **Bed Spaces** — Room/bed availability (Available or Occupied). Data from Firebase Firestore.
- **Tenant Balance** — Monthly rent, amount paid, remaining balance, status (Paid, Due Soon, Overdue). Data from Google Sheets.
- **Parcel Status** — Tenant parcels with status (Incoming, Arrived, Claimed). Data from Google Sheets.
- **Admin** — Hidden page at `/admin` with embedded Google Forms for recording payments and updating parcel status.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Firebase (Bed Spaces)

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Add a web app and copy the config values
3. Create Firestore database
4. Add a `beds` collection with documents like:

   ```
   roomNumber: "101"
   bedNumber: "A"
   status: "available"  // or "occupied"
   ```

5. Set Firestore rules for public read:

   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /beds/{document=**} {
         allow read: if true;
         allow write: if false;
       }
     }
   }
   ```

### 3. Google Sheets (Tenant Balance & Parcels)

1. Create a Google Sheet with two tabs:
   - **TenantBalance** — Columns: `Tenant Name | Room | Bed | Monthly Rent | Amount Paid | Remaining Balance | Status`
   - **Parcels** — Columns: `Tenant Name | Room | Status`

2. Enable [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
3. Create a Service Account (IAM & Admin → Service Accounts), download JSON key
4. Share the Sheet with the service account email (Editor access)
5. Put the JSON key content in `GOOGLE_SHEETS_CREDENTIALS` (as a single-line string)

### 4. Google Forms (Admin)

1. Create a **Payment Form** — Tenant name, Room, Bed, Amount paid, Date (form responses → same Sheet or new Sheet)
2. Create a **Parcel Form** — Tenant name, Room, Status (Incoming/Arrived/Claimed)
3. Link forms to your Google Sheet (Form → Responses → Link to Sheets)
4. Get embed URLs: Form → Send → `</>` Embed HTML → copy the `src` from the iframe
5. Add to `.env.local`:
   - `NEXT_PUBLIC_PAYMENT_FORM_URL=...`
   - `NEXT_PUBLIC_PARCEL_FORM_URL=...`

### 5. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Google Sheets
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}  # Single line
GOOGLE_SHEET_ID=your_spreadsheet_id

# Admin forms (optional)
NEXT_PUBLIC_PAYMENT_FORM_URL=
NEXT_PUBLIC_PARCEL_FORM_URL=
```

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Admin page: [http://localhost:3000/admin](http://localhost:3000/admin).
