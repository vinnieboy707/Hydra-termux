module.exports = {
  apps: [
    {
      name: 'workspace-sync',
      script: './sync_workspaces.sh',
      cron: '*/15 * * * *',
      autorestart: false
    },
    {
      name: 'swarm-mesh',
      script: './dist/enterprise_swarm_mesh.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
