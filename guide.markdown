# Electron File Viewer Development Guide

## 1. Project Setup

### Initialize Project
```bash
mkdir electron-file-viewer
cd electron-file-viewer
npm init -y
npm install electron typescript @types/node --save-dev
npm install electron-store @types/electron-store --save
```

### Create Project Structure
```
electron-file-viewer/
├── src/
│   ├── main/
│   │   ├── main.ts          # Main process
│   │   └── preload.ts       # Preload script
│   ├── renderer/
│   │   ├── components/
│   │   │   ├── FileTree.tsx
│   │   │   ├── FileViewer.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── styles/
│   │   │   └── main.css
│   │   └── index.html
│   └── shared/
│       └── types.ts
├── package.json
├── tsconfig.json
└── electron-builder.json
```

## 2. Main Process Configuration

### `src/main/main.ts`
```typescript
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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

// IPC Handlers for file operations
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.filePaths[0] || null;
});

ipcMain.handle('fs:readDirectory', async (_, dirPath: string) => {
  try {
    const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return items.map(item => ({
      name: item.name,
      path: path.join(dirPath, item.name),
      isDirectory: item.isDirectory(),
      isFile: item.isFile()
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
      isFile: stats.isFile()
    };
  } catch (error) {
    throw error;
  }
});

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
```

### `src/main/preload.ts`
```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog operations
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  
  // File system operations
  readDirectory: (path: string) => ipcRenderer.invoke('fs:readDirectory', path),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  getFileStats: (path: string) => ipcRenderer.invoke('fs:getFileStats', path),
  
  // Events
  on: (channel: string, callback: Function) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
  }
});
```

## 3. Renderer Components

### `src/shared/types.ts`
```typescript
export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  children?: FileItem[];
}

export interface FileContent {
  content: string;
  path: string;
}
```

### `src/renderer/components/FileTree.tsx`
```tsx
import React, { useState, useEffect } from 'react';
import { FileItem } from '../../shared/types';

interface FileTreeProps {
  rootPath: string;
  onFileSelect: (filePath: string) => void;
}

const FileTree: React.FC<FileTreeProps> = ({ rootPath, onFileSelect }) => {
  const [tree, setTree] = useState<FileItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (rootPath) {
      loadDirectory(rootPath);
    }
  }, [rootPath]);

  const loadDirectory = async (dirPath: string) => {
    try {
      const items = await window.electronAPI.readDirectory(dirPath);
      setTree(items);
    } catch (error) {
      console.error('Error loading directory:', error);
    }
  };

  const toggleFolder = async (item: FileItem) => {
    if (item.isDirectory) {
      const newExpanded = new Set(expandedFolders);
      if (newExpanded.has(item.path)) {
        newExpanded.delete(item.path);
      } else {
        newExpanded.add(item.path);
        if (!item.children) {
          try {
            const children = await window.electronAPI.readDirectory(item.path);
            item.children = children;
          } catch (error) {
            console.error('Error loading folder:', error);
          }
        }
      }
      setExpandedFolders(newExpanded);
    } else {
      onFileSelect(item.path);
    }
  };

  const renderTreeItem = (item: FileItem, depth: number = 0) => {
    const isExpanded = expandedFolders.has(item.path);
    
    return (
      <div key={item.path}>
        <div 
          className="tree-item"
          style={{ paddingLeft: `${depth * 20 + 10}px` }}
          onClick={() => toggleFolder(item)}
        >
          {item.isDirectory ? (
            <span className="folder-icon">
              {isExpanded ? '📂' : '📁'}
            </span>
          ) : (
            <span className="file-icon">📄</span>
          )}
          <span className="item-name">{item.name}</span>
        </div>
        {item.isDirectory && isExpanded && item.children && (
          <div className="tree-children">
            {item.children.map(child => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="file-tree">
      <div className="tree-header">
        <h3>Explorer</h3>
        <button 
          className="open-folder-btn"
          onClick={async () => {
            const path = await window.electronAPI.openDirectory();
            if (path) {
              loadDirectory(path);
            }
          }}
        >
          Open Folder
        </button>
      </div>
      <div className="tree-content">
        {tree.map(item => renderTreeItem(item))}
      </div>
    </div>
  );
};

export default FileTree;
```

### `src/renderer/components/FileViewer.tsx`
```tsx
import React, { useState, useEffect } from 'react';
import { FileContent } from '../../shared/types';

interface FileViewerProps {
  filePath: string | null;
}

const FileViewer: React.FC<FileViewerProps> = ({ filePath }) => {
  const [content, setContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (filePath) {
      loadFile(filePath);
    } else {
      setContent(null);
    }
  }, [filePath]);

  const loadFile = async (path: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const stats = await window.electronAPI.getFileStats(path);
      
      if (stats.isDirectory) {
        setError('Selected item is a directory');
        setContent(null);
        return;
      }

      // Check file size (limit to 10MB for performance)
      if (stats.size > 10 * 1024 * 1024) {
        setError('File is too large to display (max 10MB)');
        setContent(null);
        return;
      }

      const fileData = await window.electronAPI.readFile(path);
      setContent(fileData);
    } catch (err) {
      setError(`Error loading file: ${err.message}`);
      setContent(null);
    } finally {
      setLoading(false);
    }
  };

  if (!filePath) {
    return (
      <div className="file-viewer empty">
        <div className="empty-state">
          <p>No file selected</p>
          <p>Select a file from the explorer to view its content</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="file-viewer loading">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="file-viewer error">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="file-viewer">
      <div className="file-header">
        <h3>{content?.path.split(/[\\/]/).pop()}</h3>
        <div className="file-path">{content?.path}</div>
      </div>
      <div className="file-content">
        <pre>{content?.content}</pre>
      </div>
    </div>
  );
};

export default FileViewer;
```

### `src/renderer/components/Sidebar.tsx`
```tsx
import React from 'react';
import FileTree from './FileTree';

interface SidebarProps {
  onFileSelect: (filePath: string) => void;
  currentPath: string;
}

const Sidebar: React.FC<SidebarProps> = ({ onFileSelect, currentPath }) => {
  return (
    <div className="sidebar">
      <FileTree rootPath={currentPath} onFileSelect={onFileSelect} />
      <div className="sidebar-footer">
        <div className="current-path">
          <small>Current: {currentPath || 'No folder open'}</small>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
```

### `src/renderer/styles/main.css`
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  height: 100vh;
  overflow: hidden;
}

.app-container {
  display: flex;
  height: 100vh;
}

/* Sidebar Styles */
.sidebar {
  width: 300px;
  background: #2d2d2d;
  color: #cccccc;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #1e1e1e;
}

.tree-header {
  padding: 10px 15px;
  border-bottom: 1px solid #1e1e1e;
  background: #252526;
}

.tree-header h3 {
  font-size: 11px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
  color: #cccccc;
}

.open-folder-btn {
  width: 100%;
  padding: 8px;
  background: #0e639c;
  color: white;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  font-size: 12px;
}

.open-folder-btn:hover {
  background: #1177bb;
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 5px 0;
}

.tree-item {
  padding: 5px 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
}

.tree-item:hover {
  background: #2a2d2e;
}

.tree-item.selected {
  background: #094771;
}

.folder-icon, .file-icon {
  margin-right: 6px;
  font-size: 14px;
}

.item-name {
  font-size: 13px;
}

.tree-children {
  overflow: hidden;
}

.sidebar-footer {
  padding: 10px;
  border-top: 1px solid #1e1e1e;
  background: #252526;
  font-size: 11px;
  color: #888;
}

.current-path {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Main Content Styles */
.main-content {
  flex: 1;
  background: #1e1e1e;
  color: #cccccc;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-header {
  padding: 10px 20px;
  background: #252526;
  border-bottom: 1px solid #1e1e1e;
}

.file-header h3 {
  font-size: 13px;
  font-weight: 600;
  color: #cccccc;
  margin-bottom: 4px;
}

.file-path {
  font-size: 11px;
  color: #888;
  font-family: monospace;
}

.file-content {
  flex: 1;
  overflow: auto;
  padding: 20px;
}

.file-content pre {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #d4d4d4;
}

/* Empty/Loading/Error States */
.empty-state, .loading-spinner, .error-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888;
}

.loading-spinner {
  font-size: 14px;
}

.error-message {
  color: #f48771;
  padding: 20px;
  text-align: center;
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 10px;
}

::-webkit-scrollbar-track {
  background: #1e1e1e;
}

::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 2px;
}

::-webkit-scrollbar-thumb:hover {
  background: #4a4a4a;
}
```

### `src/renderer/index.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Electron File Viewer</title>
    <link rel="stylesheet" href="styles/main.css">
</head>
<body>
    <div id="root"></div>
    <script type="module" src="renderer.tsx"></script>
</body>
</html>
```

### `src/renderer/renderer.tsx`
```tsx
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import Sidebar from './components/Sidebar';
import FileViewer from './components/FileViewer';
import './styles/main.css';

const App: React.FC = () => {
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');

  const handleFileSelect = (filePath: string) => {
    setCurrentFile(filePath);
  };

  const handleFolderOpen = (path: string) => {
    setCurrentPath(path);
    setCurrentFile(null);
  };

  return (
    <div className="app-container">
      <Sidebar 
        onFileSelect={handleFileSelect}
        currentPath={currentPath}
      />
      <div className="main-content">
        <FileViewer filePath={currentFile} />
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## 4. Build Configuration

### `package.json`
```json
{
  "name": "electron-file-viewer",
  "version": "1.0.0",
  "main": "dist/main/main.js",
  "scripts": {
    "start": "npm run build && electron .",
    "dev": "concurrently \"npm run build:watch\" \"npm run start:electron\"",
    "build": "tsc",
    "build:watch": "tsc --watch",
    "start:electron": "electron .",
    "package": "electron-builder",
    "package:win": "electron-builder --win",
    "package:mac": "electron-builder --mac",
    "package:linux": "electron-builder --linux"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "concurrently": "^8.0.0",
    "electron": "^25.0.0",
    "electron-builder": "^24.0.0",
    "typescript": "^5.0.0"
  },
  "dependencies": {
    "@types/electron-store": "^3.0.0",
    "electron-store": "^8.1.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "build": {
    "appId": "com.example.fileviewer",
    "productName": "File Viewer",
    "directories": {
      "output": "dist"
    },
    "files": [
      "dist/**/*"
    ],
    "mac": {
      "category": "public.app-category.developer-tools"
    },
    "win": {
      "target": "nsis"
    },
    "linux": {
      "target": "AppImage"
    }
  }
}
```

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 5. Development & Building

### Development Mode
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build
```bash
# Build for current platform
npm run package

# Build for specific platforms
npm run package:win    # Windows
npm run package:mac    # macOS
npm run package:linux  # Linux
```

## 6. Features to Add Later

1. **Syntax Highlighting**: Integrate Monaco Editor
2. **Search Functionality**: Find in files
3. **File Operations**: Create, delete, rename files
4. **Multiple Tabs**: Open multiple files in tabs
5. **Settings**: User preferences
6. **Theme Support**: Light/dark mode toggle
7. **File Size Warning**: Better handling of large files
8. **Image Support**: View images in addition to text files
9. **Keyboard Shortcuts**: VS Code-like shortcuts
10. **Extension System**: Plugin support

## 7. Security Considerations

1. **Context Isolation**: Enabled in preload script
2. **Node Integration**: Disabled in renderer
3. **File Path Validation**: Validate all file paths
4. **Size Limits**: Implement file size limits
5. **Error Handling**: Graceful error handling

This guide provides a solid foundation for a VS Code-like file viewer. The architecture is modular and can be extended with additional features as needed.