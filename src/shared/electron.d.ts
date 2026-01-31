export {};

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
      
      // Events
      on: (channel: string, callback: Function) => void;
    };
  }
}