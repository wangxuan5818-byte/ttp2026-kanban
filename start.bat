@echo off
chcp 65001 > nul
echo ╔══════════════════════════════════════╗
echo ║    TTP2026 战略看板 v2.0.0           ║
echo ║    Python FastAPI + MySQL + React    ║
echo ╚══════════════════════════════════════╝
echo.

:: 检查 Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未找到 Python，请安装 Python 3.11+
    pause
    exit /b 1
)

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未找到 Node.js，请安装 Node.js 18+
    pause
    exit /b 1
)

:: 启动后端
echo 🚀 启动 Python 后端 (端口 8000)...
cd /d "%~dp0backend"
start "TTP2026-Backend" /min cmd /c "python -m uvicorn main:app --host 0.0.0.0 --port 8000"
echo    后端启动中...
timeout /t 5 /nobreak > nul

:: 启动前端
echo 🌐 启动前端服务器 (端口 3000)...
cd /d "%~dp0"
start "TTP2026-Frontend" /min cmd /c "npx vite --port 3000"
echo    前端启动中...
timeout /t 8 /nobreak > nul

echo.
echo ╔══════════════════════════════════════╗
echo ║  服务已启动                          ║
echo ║  后端 API: http://localhost:8000     ║
echo ║  前端网页: http://localhost:3000     ║
echo ║  API 文档: http://localhost:8000/docs║
echo ╚══════════════════════════════════════╝
echo.

:: 启动 Electron 桌面客户端
if exist "%~dp0electron\node_modules\.bin\electron.cmd" (
    echo 🖥️  启动桌面客户端...
    cd /d "%~dp0electron"
    start "TTP2026-Desktop" electron .
) else (
    echo ℹ️  Electron 未安装，正在打开浏览器...
    start http://localhost:3000
)

echo 按任意键退出（服务将继续在后台运行）
pause > nul
