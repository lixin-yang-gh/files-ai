import React, { useState, useEffect, useRef } from 'react';
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
// Prompt Organizer Tab
// ──────────────────────────────────────────────
interface PromptOrganizerTabProps {
  onBackToOverview: () => void;
}

function PromptOrganizerTab({
  onBackToOverview,
}: PromptOrganizerTabProps) {

  return (
    <div className="tab-panel prompt-organizer">
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