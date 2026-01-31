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