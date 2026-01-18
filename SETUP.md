# Setup Guide - Malaysian Trade Net

## Quick Start Checklist

- [ ] Install Node.js 18+
- [ ] Create Firebase project
- [ ] Configure Firebase services (Auth, Firestore, Storage, Hosting)
- [ ] Set up `.env` file with Firebase credentials
- [ ] Install dependencies: `npm install`
- [ ] Deploy Firestore rules: `firebase deploy --only firestore:rules`
- [ ] Deploy Storage rules: `firebase deploy --only storage:rules`
- [ ] Create admin user (see below)
- [ ] Seed initial data (via admin panel or script)
- [ ] Run dev server: `npm run dev`

## Creating Admin User

### Method 1: Via Firestore Console (Easiest)
1. **Sign up a regular user:**
   - Go to: `http://localhost:5173/auth`
   - Click "Sign Up"
   - Enter email, password, and name
   - Complete signup

2. **Make user admin:**
   - Go to [Firebase Console](https://console.firebase.google.com/project/mlmplan/firestore)
   - Navigate to **Firestore Database** → **users** collection
   - Find your user document (by email)
   - Click to edit
   - Change `role` field from `user` to:
     - `admin` - Content and user management
     - `superAdmin` - Full access (recommended for first admin)
   - Save

3. **Login to admin panel:**
   - Go to: `http://localhost:5173/admin/login`
   - Use your email and password
   - You'll be redirected to `/admin/dashboard`

### Method 2: Via Firebase Admin SDK
```javascript
const admin = require('firebase-admin')
const serviceAccount = require('./mlmplan-firebase-adminsdk-fbsvc-fc1bec0203.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const auth = admin.auth()
const db = admin.firestore()

async function createAdmin() {
  const user = await auth.createUser({
    email: 'admin@example.com',
    password: 'your-password',
    displayName: 'Admin'
  })

  await db.collection('users').doc(user.uid).set({
    name: 'Admin',
    email: 'admin@example.com',
    refCode: 'ADMIN001',
    role: 'superAdmin',
    status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  })
}

createAdmin()
```

## Initial Content Setup

After logging in as admin, configure:

1. **Branding** (`/admin/branding`)
   - Upload logo
   - Set company name
   - Configure colors

2. **Packages** (`/admin/packages`)
   - Add all packages (Bronze → Double Crown)
   - Set USD and INR prices

3. **Services** (`/admin/services`)
   - Add 5 services (Forex, Share Market, Real Estate, Gold Mining, Crypto Mining)

4. **Marketing Plan** (`/admin/marketing-plan`)
   - Set direct referral percentage (default: 5%)
   - Configure level percentages (Level 1-25)

5. **Income Rules** (`/admin/income-rules`)
   - Configure "With Security" rules
   - Configure "Without Security" rules

6. **Terms** (`/admin/terms`)
   - Add terms and conditions content
   - Set admin charges percentage

7. **Contact** (`/admin/contact`)
   - Set website URL
   - Set email address

## Environment Variables

Create `.env` file:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Firebase Services Configuration

### Authentication
- Enable Email/Password
- Enable Google (optional)

### Firestore
- Start in production mode
- Deploy security rules

### Storage
- Deploy security rules
- Set up folders: `branding/`, `content/`, `users/`

### Hosting
- Configure in `firebase.json`
- Deploy with: `firebase deploy --only hosting`

## Production Deployment

1. Build the app:
   ```bash
   npm run build
   ```

2. Deploy to Firebase Hosting:
   ```bash
   firebase deploy --only hosting
   ```

3. Configure custom domain (optional) in Firebase Console

## Security Checklist

- [ ] Firestore rules deployed
- [ ] Storage rules deployed
- [ ] Admin users have proper roles
- [ ] Payment features disabled (until ready)
- [ ] Wallet crediting disabled (until ready)
- [ ] Email verification enabled (if required)
- [ ] KYC requirement configured (if required)

