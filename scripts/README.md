# Seed Data Script

This script populates Firestore with initial data matching the PDF requirements.

## Prerequisites

1. Install Firebase Admin SDK:
   ```bash
   npm install firebase-admin --save-dev
   ```

2. Download service account key:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save as `serviceAccountKey.json` in project root

## Usage

```bash
node scripts/seedData.js
```

## What It Seeds

- Site configuration
- All public pages (About, Mission/Vision, Future, Why Choose Us)
- Services (5 services)
- Packages (Bronze → Double Crown)
- Marketing configuration (5% direct referral, level percentages)
- Income rules (With/Without Security)
- Bonanza configuration
- Terms & Conditions
- Contact information
- Settings

## Note

You can also configure all this data through the Admin Panel after logging in as admin.

