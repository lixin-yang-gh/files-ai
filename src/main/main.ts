// main.ts
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),          // ← changed from preload.mjs to preload.js
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox: false,                                    // ← optional: uncomment only if needed for debugging
    },
    titleBarStyle: 'hiddenInset',
  });

  console.log(`env=${process.env.NODE_ENV}`);
  console.log(`__dirname=${__dirname}`);
  const indexPath = path.join(__dirname, '../renderer/index.html');
  console.log(`Trying to load: ${indexPath}`);

  if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else {
    console.error('index.html not found at:', indexPath);
    mainWindow.loadURL(
      'data:text/html,<h1 style="color:red">index.html not found!<br>Run: npm run build</h1>'
    );
  }

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// ────────────────────────────────────────────────
// IPC Handlers
// ────────────────────────────────────────────────

ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  return result.filePaths[0] || null;
});

ipcMain.handle('fs:readDirectory', async (_, dirPath: string) => {
  try {
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
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

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { content, path: filePath };
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('fs:getFileStats', async (_, filePath: string) => {
  try {
    const stats = await fs.promises.stat(filePath);
    return {
      size: stats.size,
      modified: stats.mtime,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
    };
  } catch (error) {
    throw error;
  }
});

// ────────────────────────────────────────────────
// App lifecycle
// ────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});