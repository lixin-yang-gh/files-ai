import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import Sidebar from './components/Sidebar';
import FileManager from './components/FileManager';
import './styles/main.css';
import './styles/file_manager.css';

const App: React.FC = () => {
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');

  const handleFileSelect = (filePath: string) => {
    setCurrentFile(filePath);
  };

  return (
    <div className="app-container">
      <Sidebar
        onFileSelect={handleFileSelect}
        currentPath={currentPath}
        onFolderOpen={setCurrentPath} // Add this prop
      />
      <div className="main-content">
        <FileManager
          filePath={currentFile}
          rootFolder={currentPath} // Pass currentPath as rootFolder
        />
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);