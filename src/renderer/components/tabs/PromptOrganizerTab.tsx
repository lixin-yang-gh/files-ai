// tabs/PromptOrganizerTab.tsx - UPDATED
import React, { useState, useEffect } from 'react';
import { getErrorMessage, getRelativePath } from '../../../shared/utils';

interface PromptOrganizerTabProps {
  selectedFilePaths: string[];
  rootFolder?: string | null;
  onBackToOverview: () => void;
}

const PromptOrganizerTab: React.FC<PromptOrganizerTabProps> = ({
  selectedFilePaths,
  rootFolder,
  onBackToOverview,
}) => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [task, setTask] = useState('');
  const [issues, setIssues] = useState('');
  const [referencedFilesContent, setReferencedFilesContent] = useState<string>('(empty)');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [viewMode, setViewMode] = useState<'raw' | 'formatted'>('raw');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied'>('idle');

  // Load file contents when selected files change
  useEffect(() => {
    const loadFileContents = async () => {
      if (selectedFilePaths.length === 0) {
        setReferencedFilesContent('(empty)');
        return;
      }

      setIsLoadingFiles(true);
      try {

        const filePromises = selectedFilePaths.map(async (filePath) => {
          try {
            const fileData = await window.electronAPI.readFile(filePath);
            const relativePath = "<project_root>"+getRelativePath(filePath, rootFolder).replace(/\\/g, '/');

            // FIXED: Better XML escaping (unchanged)
            const escapeXml = (text: string) => {
              return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
            };

            const escapedContent = escapeXml(fileData.content);
            return `<file path="${relativePath}">\n${escapedContent}\n</file>`;
          } catch (error) {
            const relativePath = getRelativePath(filePath, rootFolder);
            return `<file path="${relativePath}">\nError loading filrMessage(error)}_APPEND_TEST\n</file>`;
          }
        });

        const fileContents = await Promise.all(filePromises);
        const combinedContent = fileContents.join('\n\n');
        setReferencedFilesContent(combinedContent);
      } catch (error) {
        console.error('Error loading files:', error);
        setReferencedFilesContent(`Error loading files: ${getErrorMessage(error)}`);
      } finally {
        setIsLoadingFiles(false);
      }
    };

    loadFileContents();
  }, [selectedFilePaths, rootFolder]);

  const formatReferencedFiles = (content: string): string => {
    if (viewMode === 'raw') return content;

    try {
      let formatted = content;

      formatted = formatted.replace(
        /<file path="([^"]+)">/g,
        '<div class="file-container"><div class="file-header">&lt;file path="<span class="file-path-value">$1</span>"&gt;</div>'
      );

      // Format closing tags
      formatted = formatted.replace(
        /<\/file>/g,
        '<div class="file-footer">&lt;/file&gt;</div></div>'
      );

      // Format content inside files
      formatted = formatted.replace(
        /([^<]+)(?=<\/file>)/g,
        '<div class="file-content">$1</div>'
      );

      return formatted;
    } catch (error) {
      console.error('Error formatting content:', error);
      return content;
    }
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

    // Also copy to clipboard automatically
    navigator.clipboard.writeText(fullPrompt).catch(console.error);
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
            <h4>Referenced Files ({selectedFilePaths.length})</h4>
            <div className="status-indicator">
              <span className={`status-dot ${isLoadingFiles ? 'loading' : selectedFilePaths.length > 0 ? 'ready' : 'idle'}`}></span>
              <span>
                {isLoadingFiles ? 'Loading...' :
                  selectedFilePaths.length > 0 ? 'Ready' : 'No files'}
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
                    copyStatus === 'copied' ? 'Copied!' : 'Copy Files'}
                </button>
              </div>
            </div>

            <div className="referenced-files-content">
              {isLoadingFiles ? (
                <div className="referenced-files-loading">
                  <div className="spinner"></div>
                  Loading {selectedFilePaths.length} file{selectedFilePaths.length !== 1 ? 's' : ''}...
                </div>
              ) : selectedFilePaths.length === 0 ? (
                <div className="empty-referenced-files">
                  <div className="icon">📁</div>
                  <p>No files selected</p>
                  <p>Select files in the Explorer to see them here</p>
                </div>
              ) : viewMode === 'formatted' ? (
                <div
                  className="formatted-content"
                  dangerouslySetInnerHTML={{ __html: formattedContent }}
                />
              ) : (
                <pre className="raw-content">{referencedFilesContent}</pre>
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
            title={selectedFilePaths.length === 0 ? "Select files first" : "Generate and copy complete prompt"}
          >
            Generate & Copy Complete Prompt
          </button>
        </div>

        <div className="alert-message alert-info">
          <span>📄</span>
          <span>
            {selectedFilePaths.length > 0 ? (
              <>
                {selectedFilePaths.length} file{selectedFilePaths.length !== 1 ? 's' : ''} loaded.
                Files are automatically updated when you select/deselect files.
              </>
            ) : (
              "Select files in the Explorer to include them in your prompt."
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PromptOrganizerTab;