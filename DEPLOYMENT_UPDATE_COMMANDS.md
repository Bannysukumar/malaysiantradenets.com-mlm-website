# Deployment Update Commands

## Commands to Pull, Install, Build, and Restart PM2

### Step 1: Pull Latest Changes
```bash
git pull origin main
```

### Step 2: Install Dependencies (if package.json changed)
```bash
npm install
```

### Step 3: Install Firebase Functions Dependencies (if functions/package.json changed)
```bash
cd functions
npm install
cd ..
```

### Step 4: Build React App
```bash
npm run build
```

### Step 5: Restart PM2
```bash
pm2 restart all
```

### Step 6: Check PM2 Status
```bash
pm2 status
pm2 logs
```

---

## All-in-One Command (Run in sequence)
```bash
git pull origin main && npm install && cd functions && npm install && cd .. && npm run build && pm2 restart all && pm2 status
```

---

## Alternative: If you need to deploy Firebase Functions too
```bash
# After building React app
cd functions
firebase deploy --only functions
cd ..
```

---

## Notes:
- Make sure you're in the project root directory
- If PM2 process name is specific, use: `pm2 restart <process-name>`
- To see PM2 process names: `pm2 list`

