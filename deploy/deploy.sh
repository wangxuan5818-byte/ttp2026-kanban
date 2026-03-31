#!/bin/bash
# TTP2026 看板 - 应用部署脚本
# 每次更新代码后执行此脚本

set -e

APP_DIR="/var/www/ttp2026-kanban"
echo "====== [1/5] 拉取/复制代码 ======"
# 如果用 Git，取消注释以下两行：
# git pull origin main
# 如果手动上传，确保代码已在 $APP_DIR

echo "====== [2/5] 安装依赖 ======"
cd $APP_DIR
pnpm install --frozen-lockfile

echo "====== [3/5] 构建前端和后端 ======"
pnpm build

echo "====== [4/5] 执行数据库迁移 ======"
pnpm db:push || echo "数据库已是最新，跳过迁移"

echo "====== [5/5] 重启应用 ======"
pm2 restart ttp2026-kanban || pm2 start dist/index.js --name ttp2026-kanban
pm2 save

echo ""
echo "====== 部署完成！======"
pm2 status
