import React, { useState, useEffect } from 'react';
import FileTree from './FileTree';

interface SessionInfo {
  id: number;
  label?: string;
  totalActive: number;
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
    // Load session info on mount
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

  // Update session label when path changes
  useEffect(() => {
    if (currentPath && sessionInfo) {
      // Session label is already being set by FileTree
      // Just refresh the session info
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
      // Debounce the refresh
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
        {/* Session ID Display - Prominent */}
        <div className="session-id-display" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          background: '#2a4a5a',
          borderRadius: '4px',
          marginBottom: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '11px',
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Session
            </span>
            <span style={{
              fontSize: '18px',
              fontWeight: 'bold',
              fontFamily: 'Consolas, Monaco, monospace',
              color: '#4ec9b0',
              background: '#1e3a4a',
              padding: '2px 10px',
              borderRadius: '3px',
              minWidth: '40px',
              textAlign: 'center'
            }}>
              {sessionInfo?.id !== undefined ? sessionInfo.id.toString().padStart(2, '0') : '--'}
            </span>
          </div>
          <span style={{
            fontSize: '10px',
            color: '#6a8a9a'
          }}>
            {sessionInfo?.totalActive ?? 0}/{sessionInfo?.maxSessions ?? 100}
          </span>
        </div>

        {/* Session Label if set */}
        {sessionInfo?.label && (
          <div className="session-label" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '4px',
            padding: '4px 8px',
            background: '#2a3a4a',
            borderRadius: '3px'
          }}>
            <span style={{ fontSize: '10px', color: '#888' }}>Label:</span>
            <small style={{
              fontFamily: 'Consolas, monospace',
              color: '#9cdcfe',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {sessionInfo.label}
            </small>
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