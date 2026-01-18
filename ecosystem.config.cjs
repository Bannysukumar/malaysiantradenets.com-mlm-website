module.exports = {
  apps: [{
    name: 'malaysiantradenets',
    script: 'npx',
    args: 'serve -s dist -l 5001',
    cwd: '/www/wwwroot/malaysiantradenets.com/malaysiantradenets.com',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
}

