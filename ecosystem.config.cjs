module.exports = {
  apps: [
    {
      name: 'fast-rental-api',
      cwd: './apps/backend',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      exp_backoff_restart_delay: 200,
      max_memory_restart: '512M',
      kill_timeout: 15000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
