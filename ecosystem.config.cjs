module.exports = {
  apps: [{
    name: 'personal-assistant',
    script: '.output/server/index.mjs',
    cwd: __dirname,
    node_args: '--env-file .env.production.local',
    env: { NODE_ENV: 'production' },
    max_restarts: 10,
    min_uptime: '10s',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    time: true,
  }],
};
