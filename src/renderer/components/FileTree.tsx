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