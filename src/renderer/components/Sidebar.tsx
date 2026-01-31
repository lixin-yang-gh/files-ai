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