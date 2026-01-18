# Admin Panel Login Guide

## Step 1: Create an Admin User

You need to create a user account first, then assign admin role. There are two methods:

### Method 1: Via Web App (Recommended)

1. **Sign up as a regular user:**
   - Go to: `http://localhost:5173/auth` (or your deployed URL)
   - Click "Sign Up"
   - Enter your email, password, and name
   - Complete the signup process

2. **Make the user an admin:**
   - Go to [Firebase Console](https://console.firebase.google.com/project/mlmplan/firestore)
   - Navigate to **Firestore Database** → **users** collection
   - Find the user document (by email or UID)
   - Click on the document to edit
   - Find the `role` field
   - Change it from `user` to either:
     - `admin` - For content and user management
     - `superAdmin` - For full access including deletion
   - Save the changes

### Method 2: Using Firebase Admin SDK (Advanced)

If you have the service account key, you can create an admin user programmatically:

```javascript
// Create a script: createAdmin.js
const admin = require('firebase-admin')
const serviceAccount = require('./mlmplan-firebase-adminsdk-fbsvc-fc1bec0203.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const auth = admin.auth()
const db = admin.firestore()

async function createAdmin() {
  // Create user in Auth
  const user = await auth.createUser({
    email: 'admin@example.com',
    password: 'your-secure-password',
    displayName: 'Admin User'
  })

  // Create user document in Firestore with admin role
  await db.collection('users').doc(user.uid).set({
    name: 'Admin User',
    email: 'admin@example.com',
    refCode: 'ADMIN001',
    role: 'superAdmin', // or 'admin'
    status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  })

  console.log('Admin user created:', user.uid)
}

createAdmin()
```

Run: `node createAdmin.js`

## Step 2: Login to Admin Panel

1. **Go to Admin Login Page:**
   - URL: `http://localhost:5173/admin/login`
   - Or: `https://your-domain.com/admin/login`

2. **Enter Credentials:**
   - Email: The email you used to create the admin user
   - Password: The password you set

3. **Click "Sign In"**

4. **You'll be redirected to:** `/admin/dashboard`

## Admin Panel URLs

Once logged in, you can access:

- **Dashboard:** `/admin/dashboard`
- **Branding:** `/admin/branding`
- **Content:** `/admin/content`
- **Services:** `/admin/services`
- **Packages:** `/admin/packages`
- **Marketing Plan:** `/admin/marketing-plan`
- **Income Rules:** `/admin/income-rules`
- **Bonanza:** `/admin/bonanza`
- **Terms:** `/admin/terms`
- **Contact:** `/admin/contact`
- **Users:** `/admin/users`
- **Settings:** `/admin/settings`

## Troubleshooting

### "Invalid credentials or insufficient permissions"
- Make sure the user exists in Firebase Authentication
- Verify the `role` field in Firestore `users` collection is set to `admin` or `superAdmin`
- Check that you're using the correct email and password

### Can't access admin routes
- The user must have `role: 'admin'` or `role: 'superAdmin'` in Firestore
- Refresh the page after updating the role
- Log out and log back in

### User not found in Firestore
- If you created a user via Firebase Console Auth, you need to manually create the Firestore document
- Or sign up through the web app first, then update the role

## Quick Test

1. Sign up at `/auth`
2. Go to Firebase Console → Firestore → users collection
3. Find your user document
4. Edit `role` field to `superAdmin`
5. Go to `/admin/login` and sign in
6. You should see the admin dashboard!

