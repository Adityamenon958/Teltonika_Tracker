module.exports = {
  apps: [
    {
      name: 'Teltonika-Tracker',
      script: 'src/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      min_uptime: '10s',
      max_restarts: 20,
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
