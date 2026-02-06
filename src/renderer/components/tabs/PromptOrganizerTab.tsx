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
  const [referencedFilesContent, setReferencedFilesContent] = useState<string>('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');

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
            const relativePath = "<project_root>" + getRelativePath(filePath, rootFolder).replace(/\\/g, '/');
            
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

  const handleClearAll = () => {
    setSystemPrompt('');
    setTask('');
    setIssues('');
  };

  const handleGeneratePrompt = async () => {
    if (!systemPrompt.trim() || !task.trim() || selectedFilePaths.length === 0) {
      return;
    }

    setGenerationStatus('generating');
    
    try {
      // Build the structured prompt with Markdown headers and XML file tags
      const promptParts = [];
      
      // Add System Prompt with Markdown header
      promptParts.push(`## System Prompt\n\n${systemPrompt.trim()}\n`);
      
      // Add Task with Markdown header
      promptParts.push(`## Task\n\n${task.trim()}\n`);
      
      // Add Issues with Markdown header (only if not empty)
      if (issues.trim()) {
        promptParts.push(`## Issues & Constraints\n\n${issues.trim()}\n`);
      }
      
      // Add Referenced Files section with Markdown header
      if (referencedFilesContent.trim()) {
        promptParts.push(`## Referenced Files\n\n${referencedFilesContent}`);
      }
      
      // Combine all parts
      const fullPrompt = promptParts.join('\n\n---\n\n');
      
      // Copy to clipboard
      await navigator.clipboard.writeText(fullPrompt);
      setGenerationStatus('success');
      console.log('Generated Prompt (copied to clipboard):', fullPrompt);
      
      // Show success message for 3 seconds
      setTimeout(() => {
        setGenerationStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('Failed to generate prompt:', error);
      setGenerationStatus('error');
    }
  };

  // Calculate if Generate Prompt button should be enabled
  const canGeneratePrompt = systemPrompt.trim() && task.trim() && selectedFilePaths.length > 0;

  return (
    <div className="tab-panel prompt-organizer">
      <div className="prompt-organizer-tab">
        {/* Generate Prompt Button at the top */}
        <div className="generate-prompt-section">
          <div className="generate-prompt-header">
            <h3>Generate Prompt</h3>
            <div className="status-indicator">
              <span className={`status-dot ${isLoadingFiles ? 'loading' : selectedFilePaths.length > 0 ? 'ready' : 'idle'}`}></span>
              <span>
                {isLoadingFiles ? 'Loading...' :
                 selectedFilePaths.length > 0 ? `${selectedFilePaths.length} files ready` : 'No files selected'}
              </span>
            </div>
          </div>
          
          <button
            className={`generate-prompt-button ${!canGeneratePrompt ? 'disabled' : ''} ${generationStatus === 'success' ? 'success' : ''}`}
            onClick={handleGeneratePrompt}
            disabled={!canGeneratePrompt || generationStatus === 'generating'}
            title={!canGeneratePrompt ? "Fill in System Prompt, Task, and select at least one file" : "Generate and copy prompt to clipboard"}
          >
            {generationStatus === 'generating' ? 'Generating...' :
             generationStatus === 'success' ? '✓ Copied to Clipboard!' :
             'Generate Prompt'}
          </button>
          
          {generationStatus === 'success' && (
            <div className="alert-message alert-success">
              <span>✓</span>
              <span>Prompt generated and copied to clipboard!</span>
            </div>
          )}
          
          {generationStatus === 'error' && (
            <div className="alert-message alert-error">
              <span>⚠️</span>
              <span>Failed to generate prompt. Please try again.</span>
            </div>
          )}
        </div>

        {/* Configuration Section */}
        <div className="prompt-input-section">
          <div className="section-header">Configuration</div>
          
          <div className="prompt-input-group">
            <label htmlFor="system-prompt">
              System Prompt
              <span className="required-marker">*</span>
            </label>
            <textarea
              id="system-prompt"
              className="prompt-textarea"
              placeholder="Define the AI assistant's role, behavior, and constraints..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
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
              placeholder="Describe the specific task or objective..."
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={3}
            />
            <div className="char-counter">
              {task.length} characters
            </div>
          </div>

          <div className="prompt-input-group">
            <label htmlFor="issues">Issues & Constraints (Optional)</label>
            <textarea
              id="issues"
              className="prompt-textarea issues-textarea"
              placeholder="List any known issues, special requirements, or constraints..."
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              rows={2}
            />
            <div className="char-counter">
              {issues.length} characters
            </div>
          </div>
        </div>

        {/* Referenced Files Display */}
        <div className="referenced-files-section">
          <div className="referenced-files-header">
            <h4>Referenced Files ({selectedFilePaths.length})</h4>
            <button
              className="toolbar-button"
              onClick={onBackToOverview}
              title="Go back to file selection"
            >
              ← Back to Files
            </button>
          </div>

          <div className="referenced-files-display">
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
                  <p>Select files in the Explorer to include them in your prompt</p>
                </div>
              ) : (
                <pre className="raw-content">{referencedFilesContent}</pre>
              )}
            </div>
          </div>
        </div>

        {/* Clear All Button */}
        <div className="form-actions">
          <button
            className="action-button secondary-button"
            onClick={handleClearAll}
            disabled={!systemPrompt && !task && !issues}
          >
            Clear All Fields
          </button>
        </div>

        {/* Information Message */}
        <div className="alert-message alert-info">
          <span>💡</span>
          <span>
            <strong>Prompt Structure:</strong> The generated prompt uses Markdown headers (##) for sections
            and XML-like tags for file content. Files remain in &lt;file&gt; tags for better AI parsing.
          </span>
        </div>
      </div>
    </div>
  );
};

export default PromptOrganizerTab;