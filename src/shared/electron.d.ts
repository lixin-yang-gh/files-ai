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

      // Prompt persistence operations
      getSystemPrompt: () => Promise<string>;
      saveSystemPrompt: (value: string) => Promise<{ success: true }>;
      getTask: () => Promise<string>;
      saveTask: (value: string) => Promise<{ success: true }>;
      getSelectedHeader: () => Promise<string>;
      saveSelectedHeader: (value: string) => Promise<{ success: true }>;
      redactText: (text: string) => Promise<string>;
      
      // Events
      on: (channel: string, callback: (...args: any[]) => void) => void;
    };
  }
}