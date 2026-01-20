# Deployment Commands

## Quick Deployment Sequence

Run these commands in order:

```bash
# 1. Pull latest changes
git pull

# 2. Install dependencies
npm install

# 3. Build the project
npm run build

# 4. Restart PM2 processes
pm2 restart all
```

## One-Line Command (PowerShell)

```powershell
git pull && npm install && npm run build && pm2 restart all
```

## One-Line Command (Bash/Linux)

```bash
git pull && npm install && npm run build && pm2 restart all
```

## Step-by-Step with Status Checks

```bash
# 1. Pull latest changes
git pull
echo "✅ Git pull completed"

# 2. Install dependencies
npm install
echo "✅ Dependencies installed"

# 3. Build the project
npm run build
echo "✅ Build completed"

# 4. Restart PM2 processes
pm2 restart all
pm2 status
echo "✅ PM2 restarted"
```

## For Firebase Functions Deployment (if needed)

```bash
# Navigate to functions directory
cd functions

# Install function dependencies
npm install

# Deploy functions
firebase deploy --only functions

# Go back to root
cd ..
```

## Complete Deployment Script

```bash
# Pull changes
git pull

# Install root dependencies
npm install

# Build frontend
npm run build

# Install and deploy Firebase Functions (if needed)
cd functions
npm install
firebase deploy --only functions
cd ..

# Restart PM2
pm2 restart all

# Show PM2 status
pm2 status
pm2 logs --lines 50
```
