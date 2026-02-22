const fs = require('fs');
const path = require('path');

// Load .env.production.local so config can read LAN, etc.
const envPath = path.join(__dirname, '.env.production.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^(\w+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

module.exports = {
  apps: [{
    name: 'personal-assistant',
    script: '.output/server/index.mjs',
    cwd: __dirname,
    node_args: '--env-file .env.production.local',
    env: { NODE_ENV: 'production', HOST: process.env.LAN === '1' ? '0.0.0.0' : '127.0.0.1' },
    max_restarts: 10,
    min_uptime: '10s',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    time: true,
  }],
};
