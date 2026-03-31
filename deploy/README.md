# TTP2026 AI战略会 - 阿里云部署指南

## 前置条件
- 阿里云 ECS（Ubuntu 20.04/22.04，建议 2核4G 以上）
- 安全组开放端口：22（SSH）、80（HTTP）、443（HTTPS）
- 本地已安装：Node.js 20+、pnpm

---

## 步骤一：服务器初始化

```bash
# 上传 setup.sh 到服务器
scp deploy/setup.sh root@your-server-ip:/root/

# SSH 登录服务器
ssh root@your-server-ip

# 执行初始化脚本（安装 Node.js 20、pnpm、PM2、MySQL 8、Nginx）
chmod +x /root/setup.sh
bash /root/setup.sh
```

setup.sh 会自动完成：
- 安装 Node.js 20.x
- 安装 pnpm、PM2
- 安装并初始化 MySQL 8.0（创建数据库和用户）
- 安装 Nginx
- 配置防火墙（开放 22/80/443）

---

## 步骤二：本地构建并打包上传

> ⚠️ **在本地电脑上执行以下命令（Git Bash 或 Linux/Mac 终端）**

```bash
# 进入项目目录
cd "/d/新格尔工作/2026工作/AI文件/ttp2026-kanban"

# 1. 安装依赖
pnpm install

# 2. 构建前端和后端
pnpm build

# 3. 打包（必须包含 patches/ 和 drizzle.config.json）
tar -czf ttp2026-kanban.tar.gz \
  dist/ \
  drizzle/ \
  shared/ \
  patches/ \
  package.json \
  pnpm-lock.yaml \
  drizzle.config.ts \
  drizzle.config.json

# 4. 上传到服务器
scp ttp2026-kanban.tar.gz root@your-server-ip:/var/www/
```

> ⚠️ **Windows PowerShell 用户**改用以下命令：
```powershell
# 在项目目录下执行
pnpm install
pnpm build

$files = @('dist', 'drizzle', 'shared', 'patches', 'package.json', 'pnpm-lock.yaml', 'drizzle.config.ts', 'drizzle.config.json')
tar -czf ttp2026-kanban.tar.gz $files

scp ttp2026-kanban.tar.gz root@your-server-ip:/var/www/
```

---

## 步骤三：服务器上解压并安装依赖

```bash
# SSH 登录服务器
ssh root@your-server-ip

# 创建目录并解压
mkdir -p /data/ttp2026-kanban
tar -xzf /var/www/ttp2026-kanban.tar.gz -C /data/ttp2026-kanban/

# 进入项目目录
cd /data/ttp2026-kanban

# 安装依赖（patches/ 已包含在压缩包中，不会报 ENOENT 错误）
pnpm install --frozen-lockfile
```

---

## 步骤四：配置环境变量

```bash
cd /data/ttp2026-kanban

# 创建 .env 文件
cat > .env << 'EOF'
# 数据库（setup.sh 已自动创建）
DATABASE_URL=mysql://ttp2026:ttp2026_db_password_2026@localhost:3306/ttp2026_kanban

# JWT 密钥（请修改为随机字符串）
JWT_SECRET=ttp2026_kanban_secret_key_2026

# 运行环境
NODE_ENV=production
PORT=3000

# AI 诊断功能（DeepSeek）
BUILT_IN_FORGE_API_URL=https://api.deepseek.com
BUILT_IN_FORGE_API_KEY=sk-064cd6a285dd4b7db89f04ad61ccf183

# 钉钉集成（可选，接入后填写）
# DINGTALK_APP_KEY=your-app-key
# DINGTALK_APP_SECRET=your-app-secret
# DINGTALK_AGENT_ID=your-agent-id
EOF
```

---

## 步骤五：初始化数据库

```bash
cd /data/ttp2026-kanban

# 推送数据库 schema（创建所有表）
pnpm db:push
```

如果报错 `drizzle.config.json file does not exist`，手动创建：
```bash
cat > drizzle.config.json << 'EOF'
{
  "schema": "./drizzle/schema.ts",
  "out": "./drizzle",
  "dialect": "mysql",
  "dbCredentials": {
    "url": "mysql://ttp2026:ttp2026_db_password_2026@localhost:3306/ttp2026_kanban"
  }
}
EOF

pnpm db:push
```

验证数据库连接：
```bash
mysql -u ttp2026 -p'ttp2026_db_password_2026' -e "SHOW DATABASES;"
```

---

## 步骤六：启动应用

```bash
# 创建日志目录
mkdir -p /var/log/ttp2026-kanban

# 更新 ecosystem.config.cjs 中的路径为 /data/ttp2026-kanban
sed -i "s|/var/www/ttp2026-kanban|/data/ttp2026-kanban|g" /data/ttp2026-kanban/deploy/ecosystem.config.cjs

# 启动（使用 PM2 进程管理）
pm2 start /data/ttp2026-kanban/deploy/ecosystem.config.cjs
pm2 save
pm2 startup  # 设置开机自启（按提示执行输出的命令）

# 查看运行状态
pm2 status
pm2 logs ttp2026-kanban --lines 50
```

验证启动成功：
```bash
curl http://localhost:3000
# 应返回 HTML 页面内容
```

---

## 步骤七：配置 Nginx 反向代理

```bash
# 复制 Nginx 配置
cp /data/ttp2026-kanban/deploy/nginx.conf /etc/nginx/sites-available/ttp2026-kanban

# 编辑配置：将 your-domain.com 改为您的服务器 IP 或域名
nano /etc/nginx/sites-available/ttp2026-kanban

# 启用配置
ln -s /etc/nginx/sites-available/ttp2026-kanban /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

配置完成后访问 `http://your-server-ip` 即可打开看板。

---

## 步骤八：配置 HTTPS（有域名时强烈推荐）

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
# 证书自动续期已配置，无需手动操作
```

---

## 钉钉工作台接入

部署完成后，在钉钉开放平台接入：
1. 打开 https://open.dingtalk.com → 应用开发 → 企业内部开发 → H5微应用 → 创建
2. 首页地址填：`https://your-domain.com`（或 `http://your-server-ip`）
3. 设置可见范围 → 发布
4. 员工在钉钉工作台即可看到应用图标

---

## 日常维护

```bash
# 查看应用日志
pm2 logs ttp2026-kanban

# 重启应用
pm2 restart ttp2026-kanban

# 更新代码后重新部署
cd /data/ttp2026-kanban
bash deploy/deploy.sh
```

---

## 备份数据库

```bash
# 手动备份
mysqldump -u ttp2026 -p'ttp2026_db_password_2026' ttp2026_kanban > backup_$(date +%Y%m%d).sql

# 恢复
mysql -u ttp2026 -p'ttp2026_db_password_2026' ttp2026_kanban < backup_20260101.sql
```

---

## 常见报错处理

| 报错 | 原因 | 解决方案 |
|------|------|----------|
| `ENOENT: patches/wouter@3.7.1.patch` | patches/ 目录未打包 | 重新打包，确保包含 patches/ 目录 |
| `drizzle.config.json does not exist` | 配置文件未上传 | 按步骤五手动创建 drizzle.config.json |
| `Cannot find module` | 依赖未安装 | 服务器上执行 `pnpm install` |
| `Access denied for user` | 数据库密码错误 | 检查 `.env` 中 `DATABASE_URL` |
| `EADDRINUSE: address already in use` | 端口被占用 | `pm2 delete all` 后重新启动 |
| `dist/ not found` | 未构建 | 本地执行 `pnpm build` 后重新上传 |
| `pnpm: command not found` | pnpm 未安装 | `npm install -g pnpm` |
