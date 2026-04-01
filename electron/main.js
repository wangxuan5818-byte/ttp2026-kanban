/**
 * TTP2026 战略看板 - Electron 桌面客户端主进程
 * v2.0 - Python + MySQL + React + Electron
 * 支持开发模式（连接本地vite服务）和生产模式（加载打包静态文件）
 */
const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

// ============================================================
// 配置
// ============================================================
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// 云端后端地址（生产模式使用）
const CLOUD_BACKEND_URL = 'https://ttp2026kanban.xyz';

const CONFIG = {
  BACKEND_PORT: 8000,
  FRONTEND_PORT: 3000,
  // 生产模式使用云端，开发模式使用本地
  BACKEND_URL: isDev ? 'http://localhost:8000' : CLOUD_BACKEND_URL,
  FRONTEND_URL: isDev ? 'http://localhost:3000' : CLOUD_BACKEND_URL,
  APP_NAME: 'TTP2026 战略看板',
  APP_VERSION: '2.0.0',
};

let mainWindow = null;
let backendProcess = null;
let splashWindow = null;

// ============================================================
// 启动画面
// ============================================================
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false },
  });

  const splashHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
        color: white; font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; height: 100vh;
        border-radius: 16px; border: 1px solid rgba(230,57,70,0.3);
      }
      .logo { font-size: 56px; font-weight: 900; color: #e63946; letter-spacing: 6px;
              text-shadow: 0 0 30px rgba(230,57,70,0.5); }
      .subtitle { font-size: 15px; color: #8888aa; margin-top: 10px; letter-spacing: 3px; }
      .version { font-size: 12px; color: #555577; margin-top: 6px; }
      .loading { margin-top: 40px; display: flex; align-items: center; gap: 10px;
                 font-size: 13px; color: #aaaacc; }
      .spinner { width: 18px; height: 18px; border: 2px solid #2d2d4e;
                 border-top-color: #e63946; border-radius: 50%;
                 animation: spin 0.8s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .progress { margin-top: 24px; width: 260px; height: 3px; background: #2d2d4e;
                  border-radius: 2px; overflow: hidden; }
      .progress-bar { height: 100%;
                      background: linear-gradient(90deg, #e63946, #ff6b6b);
                      border-radius: 2px; animation: progress 3.5s ease-in-out forwards; }
      @keyframes progress { from { width: 0%; } to { width: 95%; } }
    </style></head>
    <body>
      <div class="logo">TTP2026</div>
      <div class="subtitle">战略看板指挥系统</div>
      <div class="version">v2.0.0 · Python + MySQL + Electron</div>
      <div class="loading">
        <div class="spinner"></div>
        <span id="status">正在初始化系统...</span>
      </div>
      <div class="progress"><div class="progress-bar"></div></div>
    </body></html>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
}

// ============================================================
// 主窗口
// ============================================================
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: CONFIG.APP_NAME,
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // 菜单
  const menuTemplate = [
    {
      label: '文件',
      submenu: [
        { label: '刷新', accelerator: 'F5', click: () => mainWindow.webContents.reload() },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '放大', accelerator: 'CmdOrCtrl+=', click: () => mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 0.5) },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', click: () => mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 0.5) },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', click: () => mainWindow.webContents.setZoomLevel(0) },
        { type: 'separator' },
        { label: '全屏', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
        { type: 'separator' },
        { label: '开发者工具', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: '关于 TTP2026 战略看板',
            message: `TTP2026 战略看板系统\n版本：${CONFIG.APP_VERSION}\n\n技术栈：React + Python FastAPI + MySQL + Electron\n\n© 2026 TTP集团`,
          }),
        },
        { label: 'API 文档', click: () => shell.openExternal(`${CONFIG.BACKEND_URL}/docs`) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  // 加载页面 - 生产模式直接加载云端，开发模式连接本地vite服务
  if (isDev) {
    mainWindow.loadURL(CONFIG.FRONTEND_URL);
  } else {
    // 生产模式：直接加载 Railway 云端
    mainWindow.loadURL(CLOUD_BACKEND_URL);
  }

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ============================================================
// 检查服务是否可用
// ============================================================
function checkService(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode < 500) resolve(true);
        else retry();
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) reject(new Error(`服务 ${url} 启动超时`));
        else setTimeout(check, 500);
      });
      req.setTimeout(2000, () => { req.destroy(); retry(); });
    };
    const retry = () => setTimeout(check, 500);
    check();
  });
}

// ============================================================
// 应用启动
// ============================================================
app.whenReady().then(async () => {
  createSplashWindow();

  if (isDev) {
    // 开发模式：等待前后端服务就绪
    try {
      await checkService(`${CONFIG.BACKEND_URL}/api/health`, 15000);
      console.log('✅ 后端服务就绪');
      await checkService(CONFIG.FRONTEND_URL, 30000);
      console.log('✅ 前端服务就绪');
    } catch (err) {
      console.warn('⚠️ 服务检查超时，直接启动窗口:', err.message);
    }
    createMainWindow();
  } else {
    // 生产模式：检查后端，然后加载本地静态文件
    try {
      await checkService(`${CONFIG.BACKEND_URL}/api/health`, 10000);
      console.log('✅ 后端服务就绪');
    } catch (err) {
      console.warn('⚠️ 后端未就绪，将以离线模式运行');
    }
    createMainWindow();
  }
});

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on('will-quit', () => {
  if (backendProcess) backendProcess.kill();
});

// IPC
ipcMain.handle('get-app-version', () => CONFIG.APP_VERSION);
ipcMain.handle('get-backend-url', () => CONFIG.BACKEND_URL);
