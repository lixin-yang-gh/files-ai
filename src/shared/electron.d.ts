// src/shared/electron.d.ts
export { };

// Session types shared between main and renderer
export interface SessionInfo {
  id: number; // 0-99
  label?: string;
  totalActive: number;
  maxSessions: number;
}

export interface SessionMetadata {
  id: number;
  createdAt: number;
  lastActive: number;
  displayLabel?: string;
}

declare global {
  interface Window {
    electronAPI: {
      // Dialog operations
      openDirectory: () => Promise<string | null>;

      // File system operations
      readDirectory: (path: string) => Promise<Array<{
        name: string;
        path: string;
        isDirectory: boolean;
        isFile: boolean;
      }>>;

      readFile: (path: string) => Promise<{
        content: string;
        path: string;
      }>;

      getFileStats: (path: string) => Promise<{
        size: number;
        isDirectory: boolean;
        isFile: boolean;
        mtime: number;
        birthtime: number;
      }>;

      writeFile: (path: string, content: string) => Promise<{ success: true }>;

      // Store operations
      getLastOpenedFolder: () => Promise<string | undefined>;
      saveLastOpenedFolder: (path: string) => Promise<{ success: true }>;

      // Prompt persistence operations
      getSystemPrompt: () => Promise<string>;
      saveSystemPrompt: (value: string) => Promise<{ success: true }>;
      getTask: () => Promise<string>;
      saveTask: (value: string) => Promise<{ success: true }>;
      getIssues: () => Promise<string>;
      saveIssues: (value: string) => Promise<{ success: true }>;
      getSelectedHeader: () => Promise<string>;
      saveSelectedHeader: (value: string) => Promise<{ success: true }>;
      getMaskedSubstrings: () => Promise<string>;
      saveMaskedSubstrings: (value: string) => Promise<{ success: true }>;

      // Redaction
      redactText: (text: string) => Promise<string>;

      // Session management
      updateFileCount: (count: number) => Promise<{ success: true }>;
      setSessionLabel: (label: string) => Promise<{ success: true }>;
      getSessionInfo: () => Promise<SessionInfo | null>;
      getSessionId: () => Promise<number | null>;
      getAllSessions: () => Promise<SessionMetadata[]>;
      getActiveSessionsCount: () => Promise<number>;

      // Events
      on: (channel: string, callback: (...args: any[]) => void) => void;
    };
  }
}