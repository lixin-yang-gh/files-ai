import { app, BrowserWindow, ipcMain, dialog, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
// import { redactum } from "redactum";
import { redactContent } from './redaction-config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define the store schema
interface StoreSchema {
  lastOpenedFolder?: string;
  systemPrompt?: string;
  task?: string;
  issues?: string;
  selectedHeader?: string;
  windowBounds?: { x: number; y: number; width: number; height: number };
}

// Initialize electron-store
const store = new Store<StoreSchema>({
  defaults: {
    lastOpenedFolder: undefined,
    systemPrompt: "",
    task: '',
    issues: '',
    selectedHeader: 'issues',
    windowBounds: { width: 1200, height: 800, x: 100, y: 100 }
  },
  name: 'app-settings'
});

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  const bounds = getValidatedWindowBounds();

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

  console.log(`env=${process.env.NODE_ENV}`);

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    console.log(`Trying to load: ${indexPath}`);
    if (await fs.access(indexPath).then(() => true).catch(() => false)) {
      mainWindow.loadFile(indexPath);
    } else {
      console.error('index.html not found at:', indexPath);
      console.log('Current __dirname:', __dirname);
      try {
        console.log('Files in dist/renderer:', await fs.readdir(path.join(__dirname, '../renderer')));
      } catch (e) {
        console.error('Cannot read dist/renderer:', e);
      }
      mainWindow.loadURL(
        'data:text/html,<h1 style="color:red">index.html not found!<br>Run: npm run build<br>Check console for details</h1>'
      );
    }
  }

  const saveBounds = () => {
    if (mainWindow && !mainWindow.isMinimized()) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  };
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);
  mainWindow.on('close', saveBounds);

  console.log(`__dirname=${__dirname}`);
}

const getValidatedWindowBounds = () => {
  const saved = store.get('windowBounds') as { x?: number; y?: number; width?: number; height?: number } || {};
  let { width = 1200, height = 800, x = 100, y = 100 } = saved;

  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;

  // If bigger than screen > resize to fill screen and move to top-left
  if (width > screenW || height > screenH) {
    width = screenW;
    height = screenH;
    x = 0;
    y = 0;
  } else {
    // Ensure fully visible (clamp position)
    x = Math.max(0, Math.min(x, screenW - width));
    y = Math.max(0, Math.min(y, screenH - height));
  }

  return { width, height, x, y };
};

// IPC Handlers
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

// Store-related IPC handlers - ADD THESE
ipcMain.handle('store:getLastOpenedFolder', () => {
  return store.get('lastOpenedFolder');
});

ipcMain.handle('store:saveLastOpenedFolder', (_, folderPath: string) => {
  store.set('lastOpenedFolder', folderPath);
  return { success: true };
});

ipcMain.handle('store:getSystemPrompt', () => {
  return store.get('systemPrompt') || '';
});

ipcMain.handle('store:saveSystemPrompt', (_, value: string) => {
  store.set('systemPrompt', value);
  return { success: true };
});

ipcMain.handle('store:getTask', () => {
  return store.get('task') || '';
});

ipcMain.handle('store:saveTask', (_, value: string) => {
  store.set('task', value);
  return { success: true };
});

ipcMain.handle('store:getSelectedHeader', () => {
  return store.get('selectedHeader') || 'issues';
});

ipcMain.handle('store:saveSelectedHeader', (_, value: string) => {
  store.set('selectedHeader', value);
  return { success: true };
});

ipcMain.handle('store:getIssues', () => {
  return store.get('issues') || '';
});

ipcMain.handle('store:saveIssues', (_, value: string) => {
  store.set('issues', value);
  return { success: true };
});

ipcMain.handle('redact-text', async (_, text: string) => {
  try {
    // const clean = redactum(text).redactedText;
    // return clean;
    return redactContent(text);
  } catch (error) {
    console.error('Redaction failed:', error);
    return text; // Fallback to original text on error
  }
});

// App lifecycle
app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});