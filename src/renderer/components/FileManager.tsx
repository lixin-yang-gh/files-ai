import React, { useState, useEffect } from 'react';
import { FileContent } from '../../shared/types';
import { getErrorMessage,getRelativePath } from '../../shared/utils';

interface FileManagerProps {
    filePath: string | null;
    rootFolder?: string | null; // ← we'll use this to compute relative path
}

const FileManager: React.FC<FileManagerProps> = ({ filePath, rootFolder }) => {
    const [content, setContent] = useState<FileContent | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState(1); // 0 = empty tab, 1 = content tab

    useEffect(() => {
        if (filePath) {
            loadFile(filePath);
            setActiveTab(1); // auto-switch to content tab when file is selected
        } else {
            setContent(null);
            setActiveTab(0);
        }
    }, [filePath]);

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

    const relativePath =getRelativePath(filePath, rootFolder);
    const fileName = relativePath.split(/[\\/]/).pop() || 'Untitled';
    const header_bar_text="File Manager"

    if (!filePath) {
        return (
            <div className="file-manager empty">
                <div className="header-bar">{header_bar_text}</div>
                <div className="tabs-container">
                    <div className="tab-list">
                        <button className="tab active">Overview</button>
                        <button className="tab">No file selected</button>
                    </div>
                    <div className="tab-content empty-state">
                        <p>No file selected</p>
                        <p>Select a file from the explorer to view its content</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="file-manager">
            {/* Fixed header bar */}
            <div className="header-bar">{header_bar_text}</div>

            {/* Tabs area */}
            <div className="tabs-container">
                <div className="tab-list">
                    <button
                        className={`tab ${activeTab === 0 ? 'active' : ''}`}
                        onClick={() => setActiveTab(0)}
                    >
                        Overview
                    </button>

                    <button
                        className={`tab ${activeTab === 1 ? 'active' : ''}`}
                        onClick={() => setActiveTab(1)}
                        title={filePath}
                    >
                        {relativePath}
                    </button>
                </div>

                <div className="tab-content">
                    {loading ? (
                        <div className="loading-spinner">Loading...</div>
                    ) : error ? (
                        <div className="error-message">{error}</div>
                    ) : activeTab === 0 ? (
                        // Tab 1: empty / future placeholder
                        <div className="empty-tab-content">
                            <p>File overview / metadata / AI analysis coming soon...</p>
                        </div>
                    ) : (
                        // Tab 2: file content
                        <div className="file-content-view">
                            <div className="file-header">
                                <h3>{fileName}</h3>
                                <div className="file-path" title={filePath}>
                                    {filePath}
                                </div>
                            </div>
                            <pre>{content?.content}</pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FileManager;