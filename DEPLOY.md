# Deployment Guide

## Prerequisites

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase (if not already done):
   ```bash
   firebase init
   ```
   Select:
   - Firestore (rules and indexes)
   - Storage (rules)
   - Hosting

## Deployment Commands

### Deploy Everything (Recommended)
```bash
firebase deploy
```

This will deploy:
- Firestore rules
- Firestore indexes
- Storage rules
- Hosting (after building)

### Deploy Individual Services

#### Deploy Firestore Rules Only
```bash
firebase deploy --only firestore:rules
```

#### Deploy Firestore Indexes Only
```bash
firebase deploy --only firestore:indexes
```

#### Deploy Storage Rules Only
```bash
firebase deploy --only storage:rules
```

#### Deploy Hosting Only
```bash
npm run build
firebase deploy --only hosting
```

### Deploy Rules and Indexes (No Hosting)
```bash
firebase deploy --only firestore,storage
```

## Step-by-Step Deployment

1. **Build the application:**
   ```bash
   npm install
   npm run build
   ```

2. **Deploy Firestore rules and indexes:**
   ```bash
   firebase deploy --only firestore
   ```

3. **Deploy Storage rules:**
   ```bash
   firebase deploy --only storage:rules
   ```

4. **Deploy Hosting:**
   ```bash
   firebase deploy --only hosting
   ```

## Verify Deployment

After deployment, verify in Firebase Console:
- Firestore → Rules (should show deployed rules)
- Firestore → Indexes (should show deployed indexes)
- Storage → Rules (should show deployed rules)
- Hosting → Should show your deployed site URL

## Troubleshooting

### If deployment fails:
1. Check you're logged in: `firebase login`
2. Verify project: `firebase projects:list`
3. Check project ID matches: `firebase use mlmplan`
4. Review error messages in terminal

### Common Issues:
- **Permission denied**: Make sure you're logged in and have project access
- **Rules syntax error**: Check firestore.rules and storage.rules files
- **Index errors**: Check firestore.indexes.json file

