import React, { useState, useEffect, useCallback } from 'react';
import {
  getErrorMessage,
  getRelativePath,
  sanitizeText,
} from '../../../shared/utils';

interface PromptOrganizerTabProps {
  selectedFilePaths: string[];
  rootFolder?: string | null;
  onBackToOverview: () => void;
}

// Define prepend and append button configurations for scalability
const PREPEND_BUTTONS: Array<{ key: string; value: string }> = [
  { key: 'Propose a solution', value: 'Please propose a solution.' },
  { key: 'Propose enhancements', value: 'Please propose enhancements.' },
  { key: 'Propose improvements', value: 'Please propose improvements.' },
  { key: 'Propose fixes', value: 'Please propose fixes.' },
];

const APPEND_BUTTONS: Array<{ key: string; value: string }> = [
  { key: 'Full files', value: 'Please print out full contents of all the updated files.' },
  { key: 'Updated blocks', value: 'Please print out the added/updated/deleted blocks with proper operation markings (add, update and delete) and their locations in the files.' },
];

const PromptOrganizerTab: React.FC<PromptOrganizerTabProps> = ({
  selectedFilePaths,
  rootFolder,
  onBackToOverview,
}) => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [task, setTask] = useState('');
  const [issues, setIssues] = useState('');
  const [useErrorsLabel, setUseErrorsLabel] = useState(false);
  const [referencedFilesContent, setReferencedFilesContent] = useState<string>('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');
  const [lastSavedSystemPrompt, setLastSavedSystemPrompt] = useState<number | null>(null);
  const [lastSavedTask, setLastSavedTask] = useState<number | null>(null);

  // Load saved system prompt and task on component mount
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        // Load system prompt
        const savedSystemPrompt = await window.electronAPI.getSystemPrompt();
        if (savedSystemPrompt) setSystemPrompt(savedSystemPrompt);

        // Load task
        const savedTask = await window.electronAPI.getTask();
        if (savedTask) setTask(savedTask);
      } catch (err) {
        console.error('Failed to load saved data:', err);
      }
    };
    loadSavedData();
  }, []);

  const saveSystemPrompt = useCallback(async (value: string) => {
    try {
      await window.electronAPI.saveSystemPrompt(value);
      setLastSavedSystemPrompt(Date.now());
    } catch (err) {
      console.error('Failed to save system prompt:', err);
    }
  }, []);

  const saveTask = useCallback(async (value: string) => {
    try {
      await window.electronAPI.saveTask(value);
      setLastSavedTask(Date.now());
    } catch (err) {
      console.error('Failed to save task:', err);
    }
  }, []);

  // Auto-save system prompt (debounced)
  useEffect(() => {
    if (systemPrompt === '') return;
    const timer = setTimeout(() => {
      saveSystemPrompt(systemPrompt);
    }, 800);
    return () => clearTimeout(timer);
  }, [systemPrompt, saveSystemPrompt]);

  // Auto-save task (debounced)
  useEffect(() => {
    if (task === '') return;
    const timer = setTimeout(() => {
      saveTask(task);
    }, 800);
    return () => clearTimeout(timer);
  }, [task, saveTask]);

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

          // Apply sanitization to file content - this will decode HTML entities
          const sanitizedContent = sanitizeText(fileData.content);

          return `<file path="${relativePath}">\n${sanitizedContent}\n</file>`;
        } catch (error) {
          const relativePath = getRelativePath(filePath, rootFolder);
          return `<file path="${relativePath}">\nError loading file: ${getErrorMessage(error)}\n</file>`;
        }
      });

      const fileContents = await Promise.all(filePromises);

      // Combine all file contents
      const combinedContent = fileContents.join('\n\n');

      setReferencedFilesContent(combinedContent);
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
  };

  // Handle prepend button click
  const handlePrepend = (textToPrepend: string) => {
    setTask(prevTask => {
      // If task is empty, just set the prepended text
      if (!prevTask.trim()) {
        return textToPrepend;
      }
      // Otherwise, add the prepended text as a new line at the beginning
      return `${textToPrepend}\n${prevTask}`;
    });
  };

  // Handle append button click
  const handleAppend = (textToAppend: string) => {
    setTask(prevTask => {
      // If task is empty, just set the appended text
      if (!prevTask.trim()) {
        return textToAppend;
      }
      // Otherwise, add the appended text as a new line at the end
      return `${prevTask}\n${textToAppend}`;
    });
  };

  const handleGeneratePrompt = async () => {
    if (!systemPrompt.trim() || !task.trim() || selectedFilePaths.length === 0) return;

    setGenerationStatus('generating');

    try {
      const promptParts = [];

      // Apply sanitization to all text inputs
      const sanitizedSystemPrompt = sanitizeText(systemPrompt.trim());
      const sanitizedTask = sanitizeText(task.trim());
      const sanitizedIssues = issues.trim() ? sanitizeText(issues.trim()) : '';

      promptParts.push(`## System Prompt\n\n${sanitizedSystemPrompt}\n`);
      promptParts.push(`## Task\n\n${sanitizedTask}\n`);

      if (sanitizedIssues) {
        const header = useErrorsLabel ? 'Errors' : 'Issues';
        promptParts.push(`## ${header}\n\n${sanitizedIssues}\n`);
      }

      if (referencedFilesContent.trim()) {
        promptParts.push(`## Referenced Files\n\n${referencedFilesContent}`);
      }

      let fullPrompt = promptParts.join('\n\n---\n\n');

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
              className={`status-dot ${isLoadingFiles ? 'loading' : selectedFilePaths.length > 0 ? 'ready' : 'idle'
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
            className={`generate-prompt-button ${!canGeneratePrompt ? 'disabled' : ''} ${generationStatus === 'success' ? 'success' : ''
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
            {lastSavedSystemPrompt && (
              <div style={{ fontSize: '11px', color: '#4ec9b0', marginTop: 2 }}>
                Saved {new Date(lastSavedSystemPrompt).toLocaleTimeString()}
              </div>
            )}
          </div>

          <div className="prompt-input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="task">
                Task <span className="required-marker">*</span>
              </label>
              <button
                className="toolbar-button"
                onClick={() => saveTask(task)}
                disabled={!task.trim()}
                style={{ fontSize: '12px', padding: '4px 10px' }}
              >
                Save
              </button>
            </div>

            {/* Prepended text buttons - First row */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {PREPEND_BUTTONS.map((button) => (
                <button
                  key={button.key}
                  className="toolbar-button"
                  onClick={() => handlePrepend(button.value)}
                  title={`Prepend: ${button.value}`}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  ⬆️ {button.key}
                </button>
              ))}
            </div>

            {/* Appended text buttons - Second row */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {APPEND_BUTTONS.map((button) => (
                <button
                  key={button.key}
                  className="toolbar-button"
                  onClick={() => handleAppend(button.value)}
                  title={`Append: ${button.value}`}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  ⬇️ {button.key}
                </button>
              ))}
            </div>

            <textarea
              id="task"
              className="prompt-textarea"
              placeholder="Describe the specific task or objective..."
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={4}
            />
            <div className="char-counter">{task.length} characters</div>
            {lastSavedTask && (
              <div style={{ fontSize: '11px', color: '#4ec9b0', marginTop: 2 }}>
                Saved {new Date(lastSavedTask).toLocaleTimeString()}
              </div>
            )}
          </div>

          <div className="prompt-input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="issues">Issues (Optional)</label>
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
              placeholder="List any known issues"
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
            <strong>Content sanitization applied:</strong> HTML entities decoded.
          </span>
        </div>
      </div>
    </div>
  );
};

export default PromptOrganizerTab;