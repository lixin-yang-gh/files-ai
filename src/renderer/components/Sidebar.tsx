import React, { useState, useEffect } from 'react';
import FileTree from './FileTree';

interface SessionInfo {
  id: number;
  label?: string;
  isDefault: boolean;
  activeCount: number;
  maxSessions: number;
}

interface SidebarProps {
  onFileSelect: (filePath: string) => void;
  currentPath: string;
  onFolderOpen: (path: string) => void;
  onSelectedPathsChange?: (paths: string[]) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  onFileSelect,
  currentPath,
  onFolderOpen,
  onSelectedPathsChange
}) => {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  useEffect(() => {
    const loadSessionInfo = async () => {
      try {
        if (window.electronAPI?.getSessionInfo) {
          const info = await window.electronAPI.getSessionInfo();
          setSessionInfo(info);
        }
      } catch (err) {
        console.error('Failed to get session info:', err);
      }
    };
    loadSessionInfo();
  }, []);

  useEffect(() => {
    if (currentPath && sessionInfo) {
      const refreshSessionInfo = async () => {
        try {
          if (window.electronAPI?.getSessionInfo) {
            const info = await window.electronAPI.getSessionInfo();
            setSessionInfo(info);
          }
        } catch (err) {
          console.error('Failed to refresh session info:', err);
        }
      };
      const timer = setTimeout(refreshSessionInfo, 500);
      return () => clearTimeout(timer);
    }
  }, [currentPath]);

  return (
    <div className="sidebar">
      <FileTree
        rootPath={currentPath}
        onFileSelect={onFileSelect}
        onFolderOpen={onFolderOpen}
        onSelectedPathsChange={onSelectedPathsChange}
      />
      <div className="sidebar-footer">
        {/* Session ID Display */}
        <div className="session-id-display">
          <div className="session-id-left">
            <span className="session-label-text">Session</span>
            <span className="session-id-number">
              {sessionInfo?.id !== undefined ? sessionInfo.id.toString().padStart(2, '0') : '--'}
            </span>
            {sessionInfo?.isDefault && (
              <span className="default-badge">DEFAULT</span>
            )}
          </div>
        </div>

        {/* Session Label if set */}
        {sessionInfo?.label && (
          <div className="session-label">
            <span style={{ fontSize: '10px', color: '#888' }}>Label:</span>
            <small>{sessionInfo.label}</small>
          </div>
        )}

        {/* Current Path */}
        <div className="current-path">
          <small>Current: {currentPath || 'No folder open'}</small>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;