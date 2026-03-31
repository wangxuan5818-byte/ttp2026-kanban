#!/bin/bash
# TTP2026 战略看板 - 一键启动脚本
# 同时启动 Python 后端 + Vite 前端 + Electron 桌面客户端

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
ELECTRON_DIR="$SCRIPT_DIR/electron"

echo "╔══════════════════════════════════════╗"
echo "║    TTP2026 战略看板 v2.0.0           ║"
echo "║    Python FastAPI + MySQL + React    ║"
echo "╚══════════════════════════════════════╝"
echo ""

# 检查 MySQL 是否运行
echo "🔍 检查 MySQL 服务..."
if ! mysqladmin -u root status >/dev/null 2>&1; then
    echo "⚠️  MySQL 未运行，尝试启动..."
    sudo service mysql start || sudo service mariadb start
    sleep 2
fi
echo "✅ MySQL 服务正常"

# 启动 Python 后端
echo ""
echo "🚀 启动 Python 后端 (端口 8000)..."
cd "$BACKEND_DIR"
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "⚠️  已创建 .env 文件，请检查数据库配置"
fi
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --log-level warning &
BACKEND_PID=$!
echo "   后端 PID: $BACKEND_PID"

# 等待后端就绪
echo "   等待后端启动..."
for i in {1..20}; do
    if curl -s http://localhost:8000/api/health >/dev/null 2>&1; then
        echo "✅ 后端就绪"
        break
    fi
    sleep 1
done

# 启动前端
echo ""
echo "🌐 启动前端开发服务器 (端口 3000)..."
cd "$SCRIPT_DIR"
NODE_ENV=development npx vite --port 3000 &
FRONTEND_PID=$!
echo "   前端 PID: $FRONTEND_PID"

# 等待前端就绪
echo "   等待前端启动..."
for i in {1..30}; do
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        echo "✅ 前端就绪"
        break
    fi
    sleep 1
done

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  服务已启动                          ║"
echo "║  后端 API: http://localhost:8000     ║"
echo "║  前端网页: http://localhost:3000     ║"
echo "║  API 文档: http://localhost:8000/docs║"
echo "╚══════════════════════════════════════╝"
echo ""

# 启动 Electron（如果已安装）
if command -v electron >/dev/null 2>&1 || [ -f "$ELECTRON_DIR/node_modules/.bin/electron" ]; then
    echo "🖥️  启动桌面客户端..."
    cd "$ELECTRON_DIR"
    if [ -f "node_modules/.bin/electron" ]; then
        ./node_modules/.bin/electron . &
    else
        electron . &
    fi
else
    echo "ℹ️  Electron 未安装，仅启动 Web 服务"
    echo "   浏览器访问: http://localhost:3000"
fi

# 等待退出信号
echo ""
echo "按 Ctrl+C 停止所有服务"
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '已停止所有服务'; exit 0" INT TERM
wait
