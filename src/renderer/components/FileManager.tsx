import React, { useState, useEffect } from 'react';
import { FileContent } from '../../shared/types';
import { getErrorMessage } from '../../shared/utils';

interface FileManagerProps {
    filePath: string | null;
}

const FileManager: React.FC<FileManagerProps> = ({ filePath }) => {
    const [content, setContent] = useState<FileContent | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (filePath) {
            loadFile(filePath);
        } else {
            setContent(null);
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

            // Check file size (limit to 10MB for performance)
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

    if (!filePath) {
        return (
            <div className="file-viewer empty">
                <div className="empty-state">
                    <p>No file selected</p>
                    <p>Select a file from the explorer to view its content</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="file-viewer loading">
                <div className="loading-spinner">Loading...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="file-viewer error">
                <div className="error-message">{error}</div>
            </div>
        );
    }

    return (
        <div className="file-viewer">
            <div className="file-header">
                <h3>{content?.path.split(/[\\/]/).pop()}</h3>
                <div className="file-path">{content?.path}</div>
            </div>
            <div className="file-content">
                <pre>{content?.content}</pre>
            </div>
        </div>
    );
};

export default FileManager;