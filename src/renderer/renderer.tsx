import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import Sidebar from './components/Sidebar';
import FileManager from './components/FileManager';
import './styles/main.css';
import './styles/file_tree.css';
import './styles/file_manager.css';

const App: React.FC = () => {
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedFilePaths, setSelectedFilePaths] = useState<string[]>([]);

  const handleFileSelect = (filePath: string) => {
    setCurrentFile(filePath);
  };

  const handleSelectedPathsChange = (paths: string[]) => {
    setSelectedFilePaths(paths);
  };

  return (
    <div className="app-container">
      <Sidebar
        onFileSelect={handleFileSelect}
        currentPath={currentPath}
        onFolderOpen={setCurrentPath}
        onSelectedPathsChange={handleSelectedPathsChange}
      />
      <div className="main-content">
        <FileManager
          filePath={currentFile}
          rootFolder={currentPath}
          selectedFilePaths={selectedFilePaths}
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