// tabs/PromptOrganizerTab.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
  const [useErrorsLabel, setUseErrorsLabel] = useState(false); // ← new state
  const [referencedFilesContent, setReferencedFilesContent] = useState<string>('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  // Load saved system prompt once
  useEffect(() => {
    const loadSavedPrompt = async () => {
      try {
        const saved = await window.electronAPI.getSystemPrompt();
        if (saved) setSystemPrompt(saved);
      } catch (err) {
        console.error('Failed to load system prompt:', err);
      }
    };
    loadSavedPrompt();
  }, []);

  const saveSystemPrompt = useCallback(async (value: string) => {
    try {
      await window.electronAPI.saveSystemPrompt(value);
    } catch (err) {
      console.error('Failed to save system prompt:', err);
    }
  }, []);

  // Auto-save system prompt (debounced)
  useEffect(() => {
    if (systemPrompt === '') return;
    const timer = setTimeout(() => {
      saveSystemPrompt(systemPrompt).then(() => {
        setLastSaved(Date.now());
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [systemPrompt, saveSystemPrompt]);

  // Load / reload referenced files content
  const loadFileContents = useCallback(async () => {
    if (selectedFilePaths.length === 0) {
      setReferencedFilesContent('');
      return;
    }

    setIsLoadingFiles(true);
    try {
      const filePromises = selectedFilePaths.map(async (filePath) => {
        try {
          const fileData = await window.electronAPI.readFile(filePath);
          const relativePath =
            "<project_root>" + getRelativePath(filePath, rootFolder).replace(/\\/g, '/');

          // Escape only XML-special characters — do NOT escape spaces or newlines
          const escapedContent = fileData.content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');

          return `<file path="${relativePath}">\n${escapedContent}\n</file>`;
        } catch (error) {
          const relativePath = getRelativePath(filePath, rootFolder);
          return `<file path="${relativePath}">\nError loading file: ${getErrorMessage(error)}\n</file>`;
        }
      });

      const fileContents = await Promise.all(filePromises);
      setReferencedFilesContent(fileContents.join('\n\n'));
    } catch (error) {
      console.error('Error loading files:', error);
      setReferencedFilesContent(`Error loading files: ${getErrorMessage(error)}`);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [selectedFilePaths, rootFolder]);

  useEffect(() => {
    loadFileContents();
  }, [loadFileContents]);

  const handleReloadAll = () => {
    loadFileContents();
  };

  const handleClearAll = () => {
    // Do NOT clear systemPrompt, task, issues — only reset other states if desired
    setGenerationStatus('idle');
    // If you really want to clear task/issues too, uncomment:
    // setTask('');
    // setIssues('');
  };

  const handleGeneratePrompt = async () => {
    if (!systemPrompt.trim() || !task.trim() || selectedFilePaths.length === 0) return;

    setGenerationStatus('generating');

    try {
      const promptParts = [];

      promptParts.push(`## System Prompt\n\n${systemPrompt.trim()}\n`);
      promptParts.push(`## Task\n\n${task.trim()}\n`);

      if (issues.trim()) {
        const header = useErrorsLabel ? 'Errors' : 'Issues & Constraints';
        promptParts.push(`## ${header}\n\n${issues.trim()}\n`);
      }

      if (referencedFilesContent.trim()) {
        promptParts.push(`## Referenced Files\n\n${referencedFilesContent}`);
      }

      let fullPrompt = promptParts.join('\n\n---\n\n');

      // Replace &nbsp; with normal space (very common when copying from web editors)
      fullPrompt = fullPrompt.replace(/\u00A0/g, ' ');

      await navigator.clipboard.writeText(fullPrompt);
      setGenerationStatus('success');

      setTimeout(() => setGenerationStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to generate prompt:', error);
      setGenerationStatus('error');
    }
  };

  const canGeneratePrompt = systemPrompt.trim() && task.trim() && selectedFilePaths.length > 0;

  return (
    <div className="tab-panel prompt-organizer">
      <div className="generate-prompt-section">
        <div className="generate-prompt-header">
          <div className="status-indicator">
            <span
              className={`status-dot ${
                isLoadingFiles ? 'loading' : selectedFilePaths.length > 0 ? 'ready' : 'idle'
              }`}
            />
            <span>
              {isLoadingFiles
                ? 'Loading...'
                : selectedFilePaths.length > 0
                ? `${selectedFilePaths.length} files ready`
                : 'No files selected'}
            </span>
          </div>

          <button
            className={`generate-prompt-button ${!canGeneratePrompt ? 'disabled' : ''} ${
              generationStatus === 'success' ? 'success' : ''
            }`}
            onClick={handleGeneratePrompt}
            disabled={!canGeneratePrompt || generationStatus === 'generating'}
          >
            {generationStatus === 'generating'
              ? 'Generating...'
              : generationStatus === 'success'
              ? '✓ Copied!'
              : 'Generate Prompt'}
          </button>
        </div>

        {generationStatus === 'success' && (
          <div className="alert-message alert-success">✓ Prompt copied to clipboard!</div>
        )}
        {generationStatus === 'error' && (
          <div className="alert-message alert-error">Failed to copy prompt</div>
        )}
      </div>

      <div className="prompt-organizer-tab">
        <div className="prompt-input-section">
          <div className="section-header">Configuration</div>

          <div className="prompt-input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="system-prompt">
                System Prompt <span className="required-marker">*</span>
              </label>
              <button
                className="toolbar-button"
                onClick={() => saveSystemPrompt(systemPrompt)}
                disabled={!systemPrompt.trim()}
                style={{ fontSize: '12px', padding: '4px 10px' }}
              >
                Save
              </button>
            </div>
            <textarea
              id="system-prompt"
              className="prompt-textarea"
              placeholder="Define the AI assistant's role, behavior, and constraints..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={5}
            />
            <div className="char-counter">{systemPrompt.length} characters</div>
            {lastSaved && (
              <div style={{ fontSize: '11px', color: '#4ec9b0', marginTop: 2 }}>
                Saved {new Date(lastSaved).toLocaleTimeString()}
              </div>
            )}
          </div>

          <div className="prompt-input-group">
            <label htmlFor="task">
              Task <span className="required-marker">*</span>
            </label>
            <textarea
              id="task"
              className="prompt-textarea"
              placeholder="Describe the specific task or objective..."
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={3}
            />
            <div className="char-counter">{task.length} characters</div>
          </div>

          <div className="prompt-input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="issues">Issues & Constraints (Optional)</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={useErrorsLabel}
                  onChange={(e) => setUseErrorsLabel(e.target.checked)}
                />
                Use "Errors" header
              </label>
            </div>
            <textarea
              id="issues"
              className="prompt-textarea issues-textarea"
              placeholder="List any known issues, special requirements, or constraints..."
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              rows={2}
            />
            <div className="char-counter">{issues.length} characters</div>
          </div>
        </div>

        <div className="referenced-files-section">
          <div className="referenced-files-header">
            <h4>Referenced Files ({selectedFilePaths.length})</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="toolbar-button" onClick={handleReloadAll} title="Reload all file contents">
                ↻ Reload All
              </button>
              <button
                className="toolbar-button"
                onClick={onBackToOverview}
                title="Go back to file selection"
              >
                ← Back to Files
              </button>
            </div>
          </div>

          <div className="referenced-files-display">
            <div className="referenced-files-content">
              {isLoadingFiles ? (
                <div className="referenced-files-loading">
                  <div className="spinner" />
                  Loading {selectedFilePaths.length} file{selectedFilePaths.length !== 1 ? 's' : ''}...
                </div>
              ) : selectedFilePaths.length === 0 ? (
                <div className="empty-referenced-files">
                  <div className="icon">📁</div>
                  <p>No files selected</p>
                  <p>Select files in the Explorer to include them</p>
                </div>
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
            disabled={generationStatus === 'generating'}
          >
            Reset Status
          </button>
        </div>

        <div className="alert-message alert-info">
          <span>💡</span>
          <span>
            <strong>Prompt structure:</strong> Markdown headers + XML-style file tags. 
            <code>&nbsp;</code> characters are replaced with normal spaces.
          </span>
        </div>
      </div>
    </div>
  );
};

export default PromptOrganizerTab;