# Deployment Commands for aapanel Linux Server

## Commands to run in: `/www/wwwroot/malaysiantradenets.com`

```bash
# 1. Clone the repository
cd /www/wwwroot
git clone https://github.com/Bannysukumar/malaysiantradenets.com-mlm-website.git malaysiantradenets.com
cd malaysiantradenets.com

# 2. Install dependencies
npm install

# 3. Build the project
npm run build

# 4. Install PM2 globally (if not already installed)
npm install -g pm2

# 5. Install serve package for serving static files
npm install -g serve

# 6. Start the application with PM2
pm2 serve dist 3000 --name malaysiantradenets --spa

# 7. Save PM2 configuration
pm2 save

# 8. Setup PM2 to start on system reboot
pm2 startup
# (Follow the command it outputs to enable startup on boot)

# 9. Check PM2 status
pm2 status

# 10. View PM2 logs
pm2 logs malaysiantradenets
```

## Alternative: Using PM2 with ecosystem file (Recommended)

```bash
# 1. Clone the repository
cd /www/wwwroot
git clone https://github.com/Bannysukumar/malaysiantradenets.com-mlm-website.git malaysiantradenets.com
cd malaysiantradenets.com

# 2. Install dependencies
npm install

# 3. Build the project
npm run build

# 4. Install PM2 globally (if not already installed)
npm install -g pm2

# 5. Start with PM2 using serve
pm2 start serve --name malaysiantradenets -- -s dist -l 3000

# 6. Save PM2 configuration
pm2 save

# 7. Setup PM2 startup
pm2 startup
# (Copy and run the command it outputs)

# 8. Check status
pm2 status
```

## If you want to use a specific port (e.g., 8080):

```bash
pm2 start serve --name malaysiantradenets -- -s dist -l 8080
pm2 save
```

## PM2 Management Commands:

```bash
# View status
pm2 status

# View logs
pm2 logs malaysiantradenets

# Restart app
pm2 restart malaysiantradenets

# Stop app
pm2 stop malaysiantradenets

# Delete app from PM2
pm2 delete malaysiantradenets

# Monitor
pm2 monit
```

## Environment Variables Setup:

If you need to set environment variables, create a `.env` file in the project root:

```bash
# Create .env file
nano .env

# Add your Firebase config (if needed)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
# ... etc

# Then rebuild
npm run build
pm2 restart malaysiantradenets
```

## Nginx Configuration (if using aapanel):

If you want to use aapanel's Nginx to serve the app:

1. In aapanel, create a new site pointing to your domain
2. Set the document root to: `/www/wwwroot/malaysiantradenets.com/dist`
3. Add this configuration in the site's Nginx settings:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Then you can run PM2 on a different port (like 3000) and proxy through Nginx, or just serve static files directly with Nginx.

