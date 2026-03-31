// PM2 进程管理配置
// 使用方法：pm2 start deploy/ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'ttp2026-kanban',
      script: 'dist/index.js',
      cwd: '/var/www/ttp2026-kanban',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: 'mysql://ttp2026:ttp2026_db_password_2026@localhost:3306/ttp2026_kanban',
        JWT_SECRET: 'ttp2026_kanban_secret_key_2026',
        // 以下根据需要填写
        // OPENAI_API_KEY: 'your-key',
        // DINGTALK_APP_KEY: 'your-key',
        // DINGTALK_APP_SECRET: 'your-secret',
      },
      error_file: '/var/log/ttp2026-kanban/error.log',
      out_file: '/var/log/ttp2026-kanban/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
