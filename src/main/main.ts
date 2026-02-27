// src/main/main.ts - REPLACE entire file
import { app, BrowserWindow, ipcMain, dialog, screen, WebContents } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import { redactContent } from './redaction-config';
import { SessionManager, StoreSchema } from './session-manager';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Session manager instance
const sessionManager = new SessionManager();

// Map to track which webContents belongs to which session
const webContentsToSession = new Map<number, number>();

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  // Check if session pool is full
  if (sessionManager.getCurrentSessionId() === null) {
    await dialog.showMessageBox({
      type: 'warning',
      title: 'Session Limit Reached',
      message: 'Maximum session limit reached (100 parallel sessions).',
      detail: 'Please close another instance of the application and try again.\n\nThis window will close automatically.',
      buttons: ['OK']
    });
    app.quit();
    return;
  }

  const sessionStore = sessionManager.getCurrentStore();
  const sessionId = sessionManager.getCurrentSessionId();

  if (!sessionStore || sessionId === null) {
    throw new Error('Failed to initialize session store');
  }

  // Validate and get window bounds
  const bounds = getValidatedWindowBounds(sessionStore);

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
  });

  // Map this window's webContents to its session
  webContentsToSession.set(mainWindow.webContents.id, sessionId);

  // Update window title with session ID
  const sessionInfo = sessionManager.getCurrentSessionInfo();
  const sessionDisplay = sessionInfo?.label
    ? `${sessionInfo.label} (Session ${sessionId})`
    : `Session ${sessionId}`;
  mainWindow.setTitle(`files-ai — ${sessionDisplay}`);

  console.log(`env=${process.env.NODE_ENV}, sessionId=${sessionId}`);

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    console.log(`Trying to load: ${indexPath}`);
    try {
      await fs.access(indexPath);
      mainWindow.loadFile(indexPath);
    } catch (e) {
      console.error('index.html not found at:', indexPath);
      console.log('Current __dirname:', __dirname);
      try {
        const files = await fs.readdir(path.join(__dirname, '../renderer'));
        console.log('Files in dist/renderer:', files);
      } catch (err) {
        console.error('Cannot read dist/renderer:', err);
      }
      mainWindow.loadURL(
        'data:text/html,<h1 style="color:red">index.html not found!<br>Run: npm run build<br>Check console for details</h1>'
      );
    }
  }

  // Save window bounds on change
  const saveBounds = () => {
    if (mainWindow && !mainWindow.isMinimized()) {
      sessionStore.set('windowBounds', mainWindow.getBounds());
    }
  };
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);
  mainWindow.on('close', saveBounds);

  // Clean up mapping when window closes
  mainWindow.webContents.on('destroyed', () => {
    webContentsToSession.delete(mainWindow!.webContents.id);
  });

  console.log(`__dirname=${__dirname}`);
}

function getValidatedWindowBounds(store: Store<StoreSchema>): { width: number; height: number; x: number; y: number } {
  const saved = store.get('windowBounds') as { x?: number; y?: number; width?: number; height?: number } | undefined;
  let { width = 1200, height = 800, x = 100, y = 100 } = saved || {};

  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;

  if (width > screenW || height > screenH) {
    width = screenW;
    height = screenH;
    x = 0;
    y = 0;
  } else {
    x = Math.max(0, Math.min(x, screenW - width));
    y = Math.max(0, Math.min(y, screenH - height));
  }

  return { width, height, x, y };
}

// Helper to get store for a specific webContents
function getStoreForWebContents(webContents: WebContents): Store<StoreSchema> | null {
  const sessionId = webContentsToSession.get(webContents.id);
  if (sessionId === undefined) return null;
  return sessionManager.getSessionStore(sessionId);
}

// IPC Handlers - all now use session-aware stores
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  return result.filePaths[0] || null;
});

ipcMain.handle('fs:readDirectory', async (_, dirPath: string) => {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    return items.map((item) => ({
      name: item.name,
      path: path.join(dirPath, item.name),
      isDirectory: item.isDirectory(),
      isFile: item.isFile(),
    }));
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('read-file', async (_, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { path: filePath, content };
  } catch (err: any) {
    throw new Error(`Cannot read file ${filePath}: ${err.message}`);
  }
});

ipcMain.handle('get-file-stats', async (_, filePath: string) => {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      mtime: stats.mtime.getTime(),
      birthtime: stats.birthtime.getTime(),
    };
  } catch (err: any) {
    console.error(`Failed to stat ${filePath}:`, err);
    throw new Error(`Cannot get stats for ${filePath}: ${err.message}`);
  }
});

ipcMain.handle('write-file', async (_, { path: filePath, content }) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (err: any) {
    throw new Error(`Cannot write file ${filePath}: ${err.message}`);
  }
});

// Store-related IPC handlers - session-aware
ipcMain.handle('store:getLastOpenedFolder', (event) => {
  const store = getStoreForWebContents(event.sender);
  return store?.get('lastOpenedFolder');
});

ipcMain.handle('store:saveLastOpenedFolder', (event, folderPath: string) => {
  const store = getStoreForWebContents(event.sender);
  if (store) {
    store.set('lastOpenedFolder', folderPath);
  }
  return { success: true };
});

ipcMain.handle('store:getSystemPrompt', (event) => {
  const store = getStoreForWebContents(event.sender);
  return store?.get('systemPrompt') || '';
});

ipcMain.handle('store:saveSystemPrompt', (event, value: string) => {
  const store = getStoreForWebContents(event.sender);
  if (store) {
    store.set('systemPrompt', value);
  }
  return { success: true };
});

ipcMain.handle('store:getTask', (event) => {
  const store = getStoreForWebContents(event.sender);
  return store?.get('task') || '';
});

ipcMain.handle('store:saveTask', (event, value: string) => {
  const store = getStoreForWebContents(event.sender);
  if (store) {
    store.set('task', value);
  }
  return { success: true };
});

ipcMain.handle('store:getIssues', (event) => {
  const store = getStoreForWebContents(event.sender);
  return store?.get('issues') || '';
});

ipcMain.handle('store:saveIssues', (event, value: string) => {
  const store = getStoreForWebContents(event.sender);
  if (store) {
    store.set('issues', value);
  }
  return { success: true };
});

ipcMain.handle('store:getSelectedHeader', (event) => {
  const store = getStoreForWebContents(event.sender);
  return store?.get('selectedHeader') || '';
});

ipcMain.handle('store:saveSelectedHeader', (event, value: string) => {
  const store = getStoreForWebContents(event.sender);
  if (store) {
    store.set('selectedHeader', value);
  }
  return { success: true };
});

ipcMain.handle('store:getMaskedSubstrings', (event) => {
  const store = getStoreForWebContents(event.sender);
  return store?.get('maskedSubstrings') || '';
});

ipcMain.handle('store:saveMaskedSubstrings', (event, value: string) => {
  const store = getStoreForWebContents(event.sender);
  if (store) {
    store.set('maskedSubstrings', value);
  }
  return { success: true };
});

ipcMain.handle('redact-text', async (_, text: string) => {
  try {
    return redactContent(text);
  } catch (error) {
    console.error('Redaction failed:', error);
    return text;
  }
});

// IPC handler to update file count for session
ipcMain.handle('session:updateFileCount', (event, count: number) => {
  sessionManager.updateFileCount(count);
  return { success: true };
});

// IPC handler to set session label (for easier identification)
ipcMain.handle('session:setLabel', (event, label: string) => {
  sessionManager.setSessionLabel(label);
  return { success: true };
});

// IPC handler to get current session info
ipcMain.handle('session:getInfo', () => {
  return sessionManager.getCurrentSessionInfo();
});

// IPC handler to get session ID for specific webContents
ipcMain.handle('session:getId', (event) => {
  const sessionId = webContentsToSession.get(event.sender.id);
  return sessionId !== undefined ? sessionId : null;
});

// IPC handler to get all sessions (for future session management UI)
ipcMain.handle('session:getAll', () => {
  return sessionManager.getAllSessions();
});

// IPC handler to get active sessions count
ipcMain.handle('session:getActiveCount', () => {
  return sessionManager.getActiveSessionsCount();
});

// App lifecycle
app.whenReady().then(async () => {
  // Session cleanup happens in SessionManager constructor
  await createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle before-quit to mark last active session
app.on('before-quit', () => {
  sessionManager.markAsLastActive();
  sessionManager.stopHeartbeat();
});