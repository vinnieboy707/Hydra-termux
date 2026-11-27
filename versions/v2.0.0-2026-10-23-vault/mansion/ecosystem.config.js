module.exports = {
  apps: [
    {
      name: 'aai-app-3000',
      script: 'server.js',
      env: { NODE_ENV: 'production', PORT: 3000 }
    },
    {
      name: 'aai-app-3001',
      script: 'server.js',
      env: { NODE_ENV: 'production', PORT: 3001 }
    },
    {
      name: 'aai-app-3002',
      script: 'server.js',
      env: { NODE_ENV: 'production', PORT: 3002 }
    }
  ]
};
