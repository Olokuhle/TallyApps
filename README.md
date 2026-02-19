# Tally 🐝

Track money between people — simply and honestly.

## What it does

Tally is a personal finance tracking app that helps you keep track of money you've given to or received from friends, family, and colleagues. It's not a payment processor — it just tracks who owes what.

## Tech Stack

- **React 18** + **Vite**
- **Firebase Auth** — Google Sign-In
- **Cloud Firestore** — real-time database, data scoped per user
- **Material Symbols** — icons
- **Albert Sans** — typography

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Firebase setup

This project uses your Firebase project `tally-app-fac0e`. The config is already set in `src/App.jsx`.

Make sure the following are enabled in your Firebase console:
- **Authentication** → Google sign-in provider
- **Firestore Database** → in production mode

### 3. Firestore Rules

Paste these into **Firestore → Rules**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4. Run locally

```bash
npm run dev
```

### 5. Build for production

```bash
npm run build
```

Output goes to `dist/` — deploy to Firebase Hosting, Vercel, or Netlify.

## Data Structure (Firestore)

```
users/
  {uid}/
    people/
      {personId}: {
        name: string          // first name only
        fullName: string      // full display name
        initials: string      // e.g. "MS"
        isLinked: boolean     // true if they're on Tally
        phone: string | null
      }
    transactions/
      {txId}: {
        personId: string
        direction: "gave" | "got"
        amount: number        // in ZAR
        currency: "ZAR"
        description: string
        datetime: ISO string
        status: "unpaid" | "paid"
        loggedByUserId: string
        loggedByName: string
        reminderCount: number
      }
```

## Screens

| Screen | Description |
|---|---|
| Login | Google Sign-In |
| Home | Balance summary, people list, recent transactions |
| Person | Per-person balance, stats, transaction history |
| Add/Edit | Keypad entry for new or existing transactions |
| Transactions | Full chronological history grouped by month |
| Profile | Account settings, notifications, privacy, help, terms |

## Deploying to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # set public dir to "dist", SPA: yes
npm run build
firebase deploy
```
