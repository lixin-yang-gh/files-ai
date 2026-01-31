export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  children?: FileItem[];
}

export interface FileContent {
  content: string;
  path: string;
}