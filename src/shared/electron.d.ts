// src/shared/electron.d.ts
export { };

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
        modified: Date;
        isDirectory: boolean;
        isFile: boolean;
      }>;

      writeFile: (path: string, content: string) => Promise<void>;

      // Store operations
      getLastOpenedFolder: () => Promise<string | undefined>;
      saveLastOpenedFolder: (path: string) => Promise<{ success: true }>;

      // Prompt persistence operations (now folder-specific)
      getSystemPrompt: (folderPath: string) => Promise<string>;
      saveSystemPrompt: (folderPath: string, value: string) => Promise<{ success: true }>;
      getTask: (folderPath: string) => Promise<string>;
      saveTask: (folderPath: string, value: string) => Promise<{ success: true }>;
      getSelectedHeader: (folderPath: string) => Promise<string>;
      saveSelectedHeader: (folderPath: string, value: string) => Promise<{ success: true }>;
      getIssues: (folderPath: string) => Promise<string>;
      saveIssues: (folderPath: string, value: string) => Promise<{ success: true }>;
      getMaskedSubstrings: (folderPath: string) => Promise<string>;
      saveMaskedSubstrings: (folderPath: string, value: string) => Promise<{ success: true }>;

      redactText: (text: string) => Promise<string>;

      // Events
      on: (channel: string, callback: (...args: any[]) => void) => void;
    };
  }
}