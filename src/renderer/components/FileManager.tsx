import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileContent } from '../../shared/types';
import { getErrorMessage, getRelativePath } from '../../shared/utils';

interface FileManagerProps {
  filePath: string | null;
  rootFolder?: string | null;
  selectedFilePaths?: string[];
  onTabChange?: (tabIndex: number) => void;
}

const FileManager: React.FC<FileManagerProps> = ({
  filePath,
  rootFolder,
  selectedFilePaths = [],
  onTabChange,
}) => {
  const [content, setContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const prevSelectedCountRef = useRef(selectedFilePaths.length);

  useEffect(() => {
    if (filePath) {
      loadFile(filePath);
    } else {
      setContent(null);
    }
  }, [filePath]);

  useEffect(() => {
    if (selectedFilePaths.length !== prevSelectedCountRef.current) {
      setActiveTab(0);
      onTabChange?.(0);
      prevSelectedCountRef.current = selectedFilePaths.length;
    }
  }, [selectedFilePaths, onTabChange]);

  const handleTabChange = (tabIndex: number) => {
    setActiveTab(tabIndex);
    onTabChange?.(tabIndex);
  };

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

      if (stats.size > 10 * 1024 * 1024) {
        setError('File is too large to display (max 10MB)');
        setContent(null);
        return;
      }

      const fileData = await window.electronAPI.readFile(path);
      setContent(fileData);
    } catch (err: unknown) {
      setError(`Error loading file: ${getErrorMessage(err)}`);
      setContent(null);
    } finally {
      setLoading(false);
    }
  };

  const headerText = `File Manager${rootFolder ? ` - ${rootFolder}` : ''}`;

  // Tab titles
  const overviewTabName = selectedFilePaths.length === 0
    ? 'Overview'
    : `Overview (${selectedFilePaths.length} selected)`;

  const promptOrganizerTabName = 'Prompt Organizer';    

  const fileEditorTabName = filePath ? getRelativePath(filePath, rootFolder) : 'No file selected';

  return (
    <div className="file-manager">
      <div className="header-bar">{headerText}</div>

      <div className="tabs-container">
        <div className="tab-list">
          <button
            className={`tab ${activeTab === 0 ? 'active' : ''}`}
            onClick={() => handleTabChange(0)}
          >
            {overviewTabName}
          </button>

          <button
            className={`tab ${activeTab === 1 ? 'active' : ''}`}
            onClick={() => handleTabChange(1)}
            title={promptOrganizerTabName}
          >
            {promptOrganizerTabName}
          </button>

          <button
            className={`tab ${activeTab === 2 ? 'active' : ''}`}
            onClick={() => handleTabChange(2)}
            disabled={!filePath}
            title={filePath ?? undefined}
          >
            {fileEditorTabName}
          </button>
        </div>

        <div className="tab-content">
          {loading && activeTab === 1 ? (
            <div className="loading-overlay">
              <div className="loading-spinner">Loading...</div>
            </div>
          ) : error && activeTab === 1 ? (
            <div className="error-message">{error}</div>
          ) : (
            <>
              {activeTab === 0 && (
                <OverviewTabContent
                  selectedFilePaths={selectedFilePaths}
                  rootFolder={rootFolder}
                />
              )}

              {activeTab === 1 && (
                <PromptOrganizerTab
                  selectedFilePaths={selectedFilePaths}
                  rootFolder={rootFolder}
                  onBackToOverview={() => handleTabChange(0)}
                />
              )}

              {activeTab === 2 && filePath && (
                <FileEditorTab
                  filePath={filePath}
                  relativePath={getRelativePath(filePath, rootFolder)}
                  fileName={fileEditorTabName.split(/[\\/]/).pop() || 'Untitled'}
                  content={content?.content}
                  onBackToOverview={() => handleTabChange(0)}
                  selectedCount={selectedFilePaths.length}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────
// Overview Tab Content
// ──────────────────────────────────────────────
interface OverviewTabContentProps {
  selectedFilePaths: string[];
  rootFolder?: string | null;
}

function OverviewTabContent({ selectedFilePaths, rootFolder }: OverviewTabContentProps) {
  if (selectedFilePaths.length === 0) {
    return (
      <div className="tab-panel empty-selection">
        <h3>No files selected</h3>
        <p>Use checkboxes in the Explorer to select files for batch operations or comparison.</p>
      </div>
    );
  }

  return (
    <div className="tab-panel overview">
      <div className="selected-files-section">
        <h3>Selected Files ({selectedFilePaths.length})</h3>

        <div className="selected-files-table">
          <div className="table-header">
            <span className="col-name">File Name</span>
            <span className="col-path">Relative Path</span>
          </div>

          <div className="table-body">
            {selectedFilePaths.map((path) => {
              const relPath = getRelativePath(path, rootFolder);
              const name = relPath.split(/[\\/]/).pop() || 'Untitled';

              return (
                <div key={path} className="table-row">
                  <span className="cell-name" title={name}>
                    {name}
                  </span>
                  <span className="cell-path" title={path}>
                    {relPath}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Prompt Organizer Tab - UPDATED
// ──────────────────────────────────────────────
interface PromptOrganizerTabProps {
  selectedFilePaths: string[];
  rootFolder?: string | null;
  onBackToOverview: () => void;
}

function PromptOrganizerTab({
  selectedFilePaths,
  rootFolder,
  onBackToOverview,
}: PromptOrganizerTabProps) {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [task, setTask] = useState('');
  const [issues, setIssues] = useState('');
  const [referencedFilesContent, setReferencedFilesContent] = useState<string>('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [viewMode, setViewMode] = useState<'raw' | 'formatted'>('raw');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied'>('idle');

  // Load file contents when selected files change
  useEffect(() => {
    const loadFileContents = async () => {
      if (selectedFilePaths.length === 0) {
        setReferencedFilesContent('');
        return;
      }

      setIsLoadingFiles(true);
      try {
        const filePromises = selectedFilePaths.map(async (filePath) => {
          try {
            const fileData = await window.electronAPI.readFile(filePath);
            const relativePath = getRelativePath(filePath, rootFolder);
            
            // Escape special characters for XML
            const escapedContent = fileData.content
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
            
            return `<file path="${relativePath}">${escapedContent}</file>`;
          } catch (error) {
            const relativePath = getRelativePath(filePath, rootFolder);
            return `<file path="${relativePath}">Error loading file: ${getErrorMessage(error)}</file>`;
          }
        });

        const fileContents = await Promise.all(filePromises);
        const combinedContent = fileContents.join('\n\n');
        setReferencedFilesContent(combinedContent);
      } catch (error) {
        setReferencedFilesContent(`Error loading files: ${getErrorMessage(error)}`);
      } finally {
        setIsLoadingFiles(false);
      }
    };

    loadFileContents();
  }, [selectedFilePaths, rootFolder]);

  const formatReferencedFiles = (content: string): string => {
    if (viewMode === 'raw') return content;
    
    // Simple formatting for better readability
    return content
      .replace(/<file path="([^"]+)">/g, '<span class="file-tag">&lt;file</span> <span class="file-path">path="$1"</span><span class="file-tag">&gt;</span>\n')
      .replace(/<\/file>/g, '\n<span class="file-tag">&lt;/file&gt;</span>')
      .replace(/(&lt;[^&]+&gt;)/g, '<span class="file-content">$1</span>');
  };

  const handleCopyToClipboard = async () => {
    if (!referencedFilesContent) return;
    
    setCopyStatus('copying');
    try {
      await navigator.clipboard.writeText(referencedFilesContent);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      setCopyStatus('idle');
    }
  };

  const handleClearAll = () => {
    setSystemPrompt('');
    setTask('');
    setIssues('');
  };

  const handleGeneratePrompt = () => {
    const fullPrompt = `System Prompt:\n${systemPrompt}\n\nTask:\n${task}\n\nIssues:\n${issues}\n\nReferenced Files:\n${referencedFilesContent}`;
    console.log('Generated Prompt:', fullPrompt);
    // You can implement additional logic here, like sending to an API
  };

  const formattedContent = formatReferencedFiles(referencedFilesContent);

  return (
    <div className="tab-panel prompt-organizer">
      <div className="prompt-organizer-tab">
        <div className="prompt-input-section">
          <div className="section-header">Prompt Configuration</div>
          
          <div className="prompt-input-group">
            <label htmlFor="system-prompt">
              System Prompt
              <span className="required-marker">*</span>
            </label>
            <textarea
              id="system-prompt"
              className="prompt-textarea"
              placeholder="Enter the system prompt for the AI assistant..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
            />
            <div className="char-counter">
              {systemPrompt.length} characters
            </div>
          </div>

          <div className="prompt-input-group">
            <label htmlFor="task">
              Task
              <span className="required-marker">*</span>
            </label>
            <textarea
              id="task"
              className="prompt-textarea"
              placeholder="Describe the task you want the AI to perform..."
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={4}
            />
            <div className="char-counter">
              {task.length} characters
            </div>
          </div>

          <div className="prompt-input-group">
            <label htmlFor="issues">Issues</label>
            <textarea
              id="issues"
              className="prompt-textarea issues-textarea"
              placeholder="List any issues, constraints, or special requirements..."
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              rows={3}
            />
            <div className="char-counter">
              {issues.length} characters
            </div>
          </div>
        </div>

        <div className="referenced-files-section">
          <div className="referenced-files-header">
            <h4>Referenced Files</h4>
            <div className="status-indicator">
              <span className={`status-dot ${isLoadingFiles ? 'loading' : selectedFilePaths.length > 0 ? 'ready' : 'idle'}`}></span>
              <span>
                {isLoadingFiles ? 'Loading...' : 
                 selectedFilePaths.length > 0 ? `${selectedFilePaths.length} files` : 'No files'}
              </span>
            </div>
          </div>

          <div className="referenced-files-display">
            <div className="referenced-files-toolbar">
              <div className="view-mode-selector">
                <button
                  className={`view-mode-button ${viewMode === 'raw' ? 'active' : ''}`}
                  onClick={() => setViewMode('raw')}
                >
                  Raw
                </button>
                <button
                  className={`view-mode-button ${viewMode === 'formatted' ? 'active' : ''}`}
                  onClick={() => setViewMode('formatted')}
                >
                  Formatted
                </button>
              </div>
              
              <div className="referenced-files-toolbar-actions">
                <button
                  className="toolbar-button"
                  onClick={onBackToOverview}
                  title="Go back to file selection"
                >
                  ← Back to Files
                </button>
                
                <button
                  className={`toolbar-button copy-button ${copyStatus === 'copied' ? 'copied' : ''}`}
                  onClick={handleCopyToClipboard}
                  disabled={!referencedFilesContent || copyStatus === 'copying' || copyStatus === 'copied'}
                  title="Copy referenced files to clipboard"
                >
                  {copyStatus === 'copying' ? 'Copying...' : 
                   copyStatus === 'copied' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="referenced-files-content">
              {isLoadingFiles ? (
                <div className="referenced-files-loading">
                  Loading file contents...
                </div>
              ) : selectedFilePaths.length === 0 ? (
                <div className="empty-referenced-files">
                  <div className="icon">📁</div>
                  <p>No files selected</p>
                  <p>Select files in the Explorer to see them here</p>
                </div>
              ) : viewMode === 'formatted' ? (
                <div dangerouslySetInnerHTML={{ __html: formattedContent }} />
              ) : (
                <pre>{referencedFilesContent}</pre>
              )}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button
            className="action-button secondary-button"
            onClick={handleClearAll}
            disabled={!systemPrompt && !task && !issues}
          >
            Clear All
          </button>
          
          <button
            className="action-button primary-button"
            onClick={handleGeneratePrompt}
            disabled={!systemPrompt.trim() || !task.trim() || selectedFilePaths.length === 0}
          >
            Generate Complete Prompt
          </button>
        </div>

        {selectedFilePaths.length > 0 && (
          <div className="alert-message alert-info">
            <span>📄</span>
            <span>
              Referenced files are automatically updated when you select/deselect files in the Explorer.
              Files are loaded with their full content and formatted as XML-like tags.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// File Editor Tab (single file viewing/editing)
// ──────────────────────────────────────────────
interface FileEditorTabProps {
  filePath: string;
  relativePath: string;
  fileName: string;
  content?: string;           // initial content from load
  onBackToOverview: () => void;
  selectedCount: number;
}

function FileEditorTab({
  filePath,
  relativePath,
  fileName,
  content: initialContent = '',
  onBackToOverview,
  selectedCount,
}: FileEditorTabProps) {
  const [text, setText] = useState(initialContent);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset editor when file changes
  useEffect(() => {
    setText(initialContent);
    setIsDirty(false);
    setSaveStatus('idle');
    setErrorMsg(null);
  }, [filePath, initialContent]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setIsDirty(e.target.value !== initialContent);
  };

  const handleSave = async () => {
    if (!isDirty) return;

    setSaveStatus('saving');
    setErrorMsg(null);

    try {
      const result = await window.electronAPI.writeFile(filePath, text);
      // If your writeFile returns { success: true } you can check it
      setIsDirty(false);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000); // auto-clear success message
    } catch (err: any) {
      setSaveStatus('error');
      setErrorMsg(err.message || 'Failed to save file');
    }
  };

  return (
    <div className="tab-panel file-editor">
      <div className="file-header">
        <div className="file-title-group">
          <h3>{fileName}</h3>
          <div className="file-path" title={filePath}>
            {relativePath}
          </div>
        </div>

        <div className="file-actions">
          {selectedCount > 0 && (
            <button className="back-btn" onClick={onBackToOverview}>
              ← Back to Selected ({selectedCount})
            </button>
          )}

          <button
            className={`save-btn ${isDirty ? 'dirty' : ''} ${saveStatus}`}
            onClick={handleSave}
            disabled={!isDirty || saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving...' :
             saveStatus === 'success' ? 'Saved ✓' :
             saveStatus === 'error' ? 'Save failed' :
             'Save'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="save-error-banner">
          {errorMsg}
        </div>
      )}

      <div className="file-editor-area">
        <textarea
          className="text-editor"
          value={text}
          onChange={handleTextChange}
          spellCheck={false}
          autoFocus
        />
      </div>
    </div>
  );
}

export default FileManager;