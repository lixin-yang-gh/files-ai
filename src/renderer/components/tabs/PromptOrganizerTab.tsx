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
  { key: 'Propose solution', value: 'Please propose the best solution for the following requirement.' },
  { key: 'Propose enhancements', value: 'Please propose enhancement.' },
  { key: 'Propose improvements', value: 'Please propose improvement.' },
  { key: 'Propose code changes', value: 'Please propose code changes.' },
  { key: 'Propose fixes', value: 'Please propose fixes.' },
];

const APPEND_BUTTONS: Array<{ key: string; value: string }> = [
  { key: 'Full files', value: 'Please print out full contents of all the updated files.' },
  { key: 'Updated blocks', value: 'Please print out the added/updated/deleted text or code in individual update blocks, each with a header indicating the operation type (add, replace, delete) and the block\'s location in the file. For a replacement operation, print both the existing block and the corresponding replacement block. Do not put any symbols on individual lines as I want to copy and paste the updated text or code directly.' },
];

const HEADER_OPTIONS: Array<{ display: string; value: string }> = [
  { display: 'Issues', value: 'issues' },
  { display: 'Feedback', value: 'feedback' },
  { display: '3rd Party Proposal', value: 'third_party_proposal' },
  { display: 'Logs', value: 'logs' },
  { display: 'Errors', value: 'errors' },
];

const PromptOrganizerTab: React.FC<PromptOrganizerTabProps> = ({
  selectedFilePaths,
  rootFolder,
  onBackToOverview,
}) => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [task, setTask] = useState('');
  const [issues, setIssues] = useState('');
  const [selectedHeader, setSelectedHeader] = useState('issues');
  const [referencedFilesContent, setReferencedFilesContent] = useState<string>('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');
  const [lastSavedSystemPrompt, setLastSavedSystemPrompt] = useState<number | null>(null);
  const [lastSavedTask, setLastSavedTask] = useState<number | null>(null);
  const [lastSavedIssues, setLastSavedIssues] = useState<number | null>(null); // Add this
  const [lastSavedHeader, setLastSavedHeader] = useState<number | null>(null);

  // Load saved data on component mount
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        // Load system prompt
        const savedSystemPrompt = await window.electronAPI.getSystemPrompt();
        if (savedSystemPrompt) setSystemPrompt(savedSystemPrompt);

        // Load task
        const savedTask = await window.electronAPI.getTask();
        if (savedTask) setTask(savedTask);

        // Load issues - NEW
        const savedIssues = await window.electronAPI.getIssues();
        if (savedIssues) setIssues(savedIssues);

        // Load header selection
        const savedHeader = await window.electronAPI.getSelectedHeader();
        if (savedHeader) {
          setSelectedHeader(savedHeader);
        } else {
          // Default to 'issues' if nothing saved
          setSelectedHeader('issues');
        }
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

  // NEW: Save issues function
  const saveIssues = useCallback(async (value: string) => {
    try {
      await window.electronAPI.saveIssues(value);
      setLastSavedIssues(Date.now());
    } catch (err) {
      console.error('Failed to save issues:', err);
    }
  }, []);

  const saveHeader = useCallback(async (value: string) => {
    try {
      await window.electronAPI.saveSelectedHeader(value);
      setLastSavedHeader(Date.now());
    } catch (err) {
      console.error('Failed to save header selection:', err);
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

  // NEW: Auto-save issues (debounced)
  useEffect(() => {
    if (issues === '') return;
    const timer = setTimeout(() => {
      saveIssues(issues);
    }, 800);
    return () => clearTimeout(timer);
  }, [issues, saveIssues]);

  // Auto-save header selection (debounced)
  useEffect(() => {
    if (!selectedHeader) return;
    const timer = setTimeout(() => {
      saveHeader(selectedHeader);
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedHeader, saveHeader]);

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

  // NEW: Handle New Task button - clear Task textarea
  const handleNewTask = () => {
    setTask('');
    // Optionally trigger save immediately
    saveTask('');
  };

  // NEW: Handle Clear Issues button - clear Issues textarea
  const handleClearIssues = () => {
    setIssues('');
    // Optionally trigger save immediately
    saveIssues('');
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
        const displayHeader = HEADER_OPTIONS.find(h => h.value === selectedHeader)?.display || 'Issues';
        promptParts.push(`## ${displayHeader}\n\n${sanitizedIssues}\n`);
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
              style={{ minHeight: '40px' }}
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
              <div style={{ display: 'flex', gap: '8px' }}>
                {/* NEW: New Task button */}
                <button
                  className="toolbar-button"
                  onClick={handleNewTask}
                  title="Clear task and start fresh"
                  style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#2a2d2e' }}
                >
                  New Task
                </button>
                <button
                  className="toolbar-button"
                  onClick={() => saveTask(task)}
                  disabled={!task.trim()}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  Save
                </button>
              </div>
            </div>

            {/* Prepended text buttons - First row */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {PREPEND_BUTTONS.map((button) => (
                <button
                  key={button.key}
                  className="toolbar-button"
                  onClick={() => handlePrepend(button.value)}
                  title={`Prepend: ${button.value}`}
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
            {/* Appended text buttons - Second row */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
              {APPEND_BUTTONS.map((button) => (
                <button
                  key={button.key}
                  className="toolbar-button"
                  onClick={() => handleAppend(button.value)}
                  title={`Append: ${button.value}`}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  ⬆️ {button.key}
                </button>
              ))}
            </div>

            <div className="char-counter">{task.length} characters</div>
            {lastSavedTask && (
              <div style={{ fontSize: '11px', color: '#4ec9b0', marginTop: 2 }}>
                Saved {new Date(lastSavedTask).toLocaleTimeString()}
              </div>
            )}
          </div>

          <div className="prompt-input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="issues">
                {HEADER_OPTIONS.find(h => h.value === selectedHeader)?.display || 'Issues'} (Optional)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {/* NEW: Clear Issues button */}
                <button
                  className="toolbar-button"
                  onClick={handleClearIssues}
                  title="Clear issues textarea"
                  style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#2a2d2e' }}
                >
                  Clear
                </button>
                <button
                  className="toolbar-button"
                  onClick={() => saveIssues(issues)}
                  disabled={!issues.trim()}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                >
                  Save
                </button>
              </div>
            </div>

            {/* Section Header Radio Buttons */}
            <div style={{ marginBottom: '12px' }}>
              <span style={{ color: '#888', fontSize: '13px', marginRight: '12px' }}>Section Header:</span>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: '8px' }}>
                {HEADER_OPTIONS.map((option) => (
                  <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="header-option"
                      value={option.value}
                      checked={selectedHeader === option.value}
                      onChange={(e) => setSelectedHeader(e.target.value)}
                      style={{ margin: 0, cursor: 'pointer' }}
                    />
                    <span style={{ color: selectedHeader === option.value ? '#ccaa00' : '#ccc' }}>
                      {option.display}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <textarea
              id="issues"
              className="prompt-textarea issues-textarea"
              placeholder="List any known issues, feedback, logs, errors, or proposals..."
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              rows={2}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="char-counter">{issues.length} characters</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                {lastSavedIssues && (
                  <div style={{ fontSize: '11px', color: '#4ec9b0' }}>
                    Saved {new Date(lastSavedIssues).toLocaleTimeString()}
                  </div>
                )}
                {lastSavedHeader && (
                  <div style={{ fontSize: '11px', color: '#4ec9b0' }}>
                    Header saved {new Date(lastSavedHeader).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
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
            onClick={() => setGenerationStatus('idle')}
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