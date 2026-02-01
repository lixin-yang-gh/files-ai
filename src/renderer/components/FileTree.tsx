import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileItem } from '../../shared/types';

interface FileTreeProps {
  rootPath: string;
  onFileSelect: (filePath: string) => void;
  onFolderOpen?: (path: string) => void;
  onSelectedPathsChange?: (paths: string[]) => void;
}

const FileTree: React.FC<FileTreeProps> = ({
  rootPath,
  onFileSelect,
  onFolderOpen,
  onSelectedPathsChange
}) => {
  const [tree, setTree] = useState<FileItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFilePaths, setSelectedFilePaths] = useState<Set<string>>(new Set());
  const [highlightedFile, setHighlightedFile] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Use ref to track if we should notify parent
  const prevSelectedPathsRef = useRef<string[]>([]);

  // Load last opened folder on initial mount
  useEffect(() => {
    const loadLastOpenedFolder = async () => {
      try {
        const lastFolder = await window.electronAPI.getLastOpenedFolder();
        if (lastFolder) {
          // Check if the folder still exists
          try {
            const stats = await window.electronAPI.getFileStats(lastFolder);
            if (stats.isDirectory) {
              // Load the directory
              await loadDirectory(lastFolder);
              if (onFolderOpen) {
                onFolderOpen(lastFolder);
              }
            }
          } catch (error) {
            console.warn('Last opened folder no longer exists:', lastFolder);
          }
        }
      } catch (error) {
        console.error('Error loading last opened folder:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    if (!isInitialized) {
      loadLastOpenedFolder();
    }
  }, [isInitialized, onFolderOpen]);

  // Notify parent about selected paths changes - use callback to avoid infinite loop
  useEffect(() => {
    const currentPaths = Array.from(selectedFilePaths);
    const prevPaths = prevSelectedPathsRef.current;
    
    // Only notify if paths actually changed
    if (onSelectedPathsChange && 
        (currentPaths.length !== prevPaths.length || 
         !currentPaths.every((path, idx) => path === prevPaths[idx]))) {
      onSelectedPathsChange(currentPaths);
      prevSelectedPathsRef.current = currentPaths;
    }
  }, [selectedFilePaths, onSelectedPathsChange]);

  useEffect(() => {
    if (rootPath && isInitialized) {
      loadDirectory(rootPath);
    }
  }, [rootPath, isInitialized]);

  const loadDirectory = async (dirPath: string) => {
    try {
      // Save the opened folder
      await window.electronAPI.saveLastOpenedFolder(dirPath);
      
      const items = await window.electronAPI.readDirectory(dirPath);
      const itemsWithState = items.map(item => ({
        ...item,
        isChecked: false,
        isHighlighted: false
      }));
      setTree(itemsWithState);
      if (onFolderOpen) {
        onFolderOpen(dirPath);
      }
    } catch (error) {
      console.error('Error loading directory:', error);
    }
  };

  // Helper function to collect all file paths from a folder recursively
  const getAllFilePathsFromFolder = useCallback((folder: FileItem): string[] => {
    const paths: string[] = [];
    
    const collectPaths = (item: FileItem) => {
      if (item.isFile) {
        paths.push(item.path);
      }
      if (item.isDirectory && item.children) {
        item.children.forEach(collectPaths);
      }
    };
    
    collectPaths(folder);
    return paths;
  }, []);

  // Handle file checkbox change
  const handleFileCheckboxChange = useCallback((item: FileItem, checked: boolean) => {
    setSelectedFilePaths(prev => {
      const newSelectedPaths = new Set(prev);
      
      if (checked) {
        newSelectedPaths.add(item.path);
      } else {
        newSelectedPaths.delete(item.path);
      }
      
      return newSelectedPaths;
    });
    
    // Update tree state
    setTree(prevTree => updateTreeItem(prevTree, item.path, { isChecked: checked }));
  }, []);

  // Handle folder checkbox change
  const handleFolderCheckboxChange = useCallback(async (item: FileItem, checked: boolean) => {
    // Load children if not already loaded
    let children = item.children;
    if (!children) {
      try {
        children = await window.electronAPI.readDirectory(item.path);
        children = children.map(child => ({
          ...child,
          isChecked: false,
          isHighlighted: false
        }));
      } catch (error) {
        console.error('Error loading folder:', error);
        return;
      }
    }
    
    const allFilePaths = getAllFilePathsFromFolder({ ...item, children });
    
    setSelectedFilePaths(prev => {
      const newSelectedPaths = new Set(prev);
      
      if (checked) {
        // Add all file paths from this folder
        allFilePaths.forEach(path => newSelectedPaths.add(path));
      } else {
        // Remove all file paths from this folder
        allFilePaths.forEach(path => newSelectedPaths.delete(path));
      }
      
      return newSelectedPaths;
    });
    
    // Update tree state for folder and all children
    setTree(prevTree => {
      const updateItemAndChildren = (items: FileItem[], targetPath: string, isChecked: boolean): FileItem[] => {
        return items.map(treeItem => {
          if (treeItem.path === targetPath) {
            const updatedItem = { ...treeItem, isChecked };
            if (updatedItem.children) {
              updatedItem.children = updateChildrenCheckedState(updatedItem.children, isChecked);
            }
            return updatedItem;
          }
          if (treeItem.children) {
            return { ...treeItem, children: updateItemAndChildren(treeItem.children, targetPath, isChecked) };
          }
          return treeItem;
        });
      };
      
      return updateItemAndChildren(prevTree, item.path, checked);
    });
  }, [getAllFilePathsFromFolder]);

  // Helper to update children checked state
  const updateChildrenCheckedState = (children: FileItem[], isChecked: boolean): FileItem[] => {
    return children.map(child => ({
      ...child,
      isChecked: child.isFile ? isChecked : false,
      children: child.children ? updateChildrenCheckedState(child.children, isChecked) : undefined
    }));
  };

  // Helper to update tree item
  const updateTreeItem = (items: FileItem[], targetPath: string, updates: Partial<FileItem>): FileItem[] => {
    return items.map(item => {
      if (item.path === targetPath) {
        return { ...item, ...updates };
      }
      if (item.children) {
        return { ...item, children: updateTreeItem(item.children, targetPath, updates) };
      }
      return item;
    });
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
            const updatedItem = { ...item, children: children.map(child => ({
              ...child,
              isChecked: false,
              isHighlighted: false
            })) };
            
            setTree(prevTree => updateTreeItem(prevTree, item.path, { children: updatedItem.children }));
          } catch (error) {
            console.error('Error loading folder:', error);
          }
        }
      }
      setExpandedFolders(newExpanded);
    } else {
      // Highlight file on click (for preview)
      setTree(prevTree => {
        // Clear previous highlights
        const clearHighlights = (items: FileItem[]): FileItem[] => {
          return items.map(treeItem => ({
            ...treeItem,
            isHighlighted: false,
            children: treeItem.children ? clearHighlights(treeItem.children) : undefined
          }));
        };
        
        const clearedTree = clearHighlights(prevTree);
        
        // Set new highlight
        const updateHighlight = (items: FileItem[], targetPath: string): FileItem[] => {
          return items.map(treeItem => {
            if (treeItem.path === targetPath) {
              return { ...treeItem, isHighlighted: true };
            }
            if (treeItem.children) {
              return { ...treeItem, children: updateHighlight(treeItem.children, targetPath) };
            }
            return treeItem;
          });
        };
        
        return updateHighlight(clearedTree, item.path);
      });
      
      setHighlightedFile(item.path);
      onFileSelect(item.path);
    }
  };

  // Helper to check if folder should appear checked based on its children
  const isFolderChecked = useCallback((folder: FileItem): boolean => {
    if (!folder.children || folder.children.length === 0) {
      return false;
    }
    
    const fileChildren = folder.children.filter(child => child.isFile);
    if (fileChildren.length === 0) return false;
    
    return fileChildren.every(file => selectedFilePaths.has(file.path));
  }, [selectedFilePaths]);

  const renderTreeItem = (item: FileItem, depth: number = 0) => {
    const isExpanded = expandedFolders.has(item.path);
    const isChecked = item.isFile 
      ? selectedFilePaths.has(item.path)
      : isFolderChecked(item);
    
    return (
      <div key={item.path}>
        <div
          className="tree-item"
          style={{ paddingLeft: `${depth * 20 + 10}px` }}
        >
          {/* Checkbox */}
          <input
            type="checkbox"
            className="tree-checkbox"
            checked={isChecked}
            onChange={(e) => {
              e.stopPropagation();
              if (item.isDirectory) {
                handleFolderCheckboxChange(item, e.target.checked);
              } else {
                handleFileCheckboxChange(item, e.target.checked);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
          
          {/* Folder/File icon and name */}
          <div 
            className={`tree-item-content ${item.isHighlighted ? 'highlighted' : ''}`}
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
        <div className="tree-header-actions">
          <button
            className="button"
            onClick={async () => {
              const path = await window.electronAPI.openDirectory();
              if (path) {
                loadDirectory(path);
                setSelectedFilePaths(new Set());
                setHighlightedFile(null);
              }
            }}
          >
            Open Folder
          </button>
          <button
            className="button"
            onClick={() => {
              setSelectedFilePaths(new Set());
              setHighlightedFile(null);
              setTree(prevTree => {
                const clearStates = (items: FileItem[]): FileItem[] => {
                  return items.map(item => ({
                    ...item,
                    isChecked: false,
                    isHighlighted: false,
                    children: item.children ? clearStates(item.children) : undefined
                  }));
                };
                return clearStates(prevTree);
              });
            }}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="tree-stats">
        <small>Selected: {selectedFilePaths.size} files | Highlighted: {highlightedFile ? '1 file' : 'none'}</small>
        {!isInitialized && <span className="loading-indicator">Loading last folder...</span>}
      </div>
      <div className="tree-content">
        {tree.map(item => renderTreeItem(item))}
      </div>
    </div>
  );
};

export default FileTree;