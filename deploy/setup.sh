#!/bin/bash
# TTP2026 看板 - 阿里云 ECS 一键部署脚本
# 适用：Ubuntu 20.04 / 22.04
# 使用方法：chmod +x setup.sh && sudo ./setup.sh

set -e

echo "====== [1/6] 更新系统 ====="
apt-get update -y
apt-get upgrade -y

echo "====== [2/6] 安装 Node.js 20 ====="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v
npm -v

echo "====== [3/6] 安装 pnpm ====="
npm install -g pnpm pm2
pnpm -v
pm2 -v

echo "====== [4/6] 安装 MySQL 8.0 ====="
apt-get install -y mysql-server
systemctl start mysql
systemctl enable mysql

# 初始化数据库
mysql -e "CREATE DATABASE IF NOT EXISTS ttp2026_kanban CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'ttp2026'@'localhost' IDENTIFIED BY 'ttp2026_db_password_2026';"
mysql -e "GRANT ALL PRIVILEGES ON ttp2026_kanban.* TO 'ttp2026'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo "====== [5/6] 安装 Nginx ====="
apt-get install -y nginx
systemctl enable nginx

echo "====== [6/6] 配置防火墙 ====="
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

echo ""
echo "====== 环境安装完成！====="
echo "MySQL 数据库：ttp2026_kanban"
echo "MySQL 用户：ttp2026 / ttp2026_db_password_2026"
echo "请继续执行 deploy.sh 部署应用"
