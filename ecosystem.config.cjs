module.exports = {
  apps: [
    {
      name: 'fast-rental-api',
      cwd: './apps/backend',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
