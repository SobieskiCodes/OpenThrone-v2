module.exports = {
  apps: [
    {
      name: 'api',
      cwd: './apps/api',
      script: 'dist/main.js',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'web',
      cwd: './apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start --port 3000',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
