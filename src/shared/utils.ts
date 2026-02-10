// utils.ts
import path from 'path';

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  } else if (typeof error === 'string') {
    return error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  } else {
    return 'An unknown error occurred';
  }
}

/**
 * Computes a clean relative path from rootFolder to filePath.
 * Returns full path if rootFolder is missing or computation fails.
 */
export function getRelativePath(filePath: string | null, rootFolder: string | null | undefined): string {
  return (filePath ?? '').replace(rootFolder ?? '', '')
}

/**
 * Check if a file or directory exists
 */
export async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await window.electronAPI.getFileStats(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Filter out non-existent files from a list
 */
export async function filterExistingFiles(filePaths: string[]): Promise<string[]> {
  const results = await Promise.all(
    filePaths.map(async (path) => {
      const exists = await checkFileExists(path);
      return exists ? path : null;
    })
  );

  return results.filter((path): path is string => path !== null);
}

// Re-export sanitization functions from sanitize.ts
export {
  decodeHtmlEntities,
  sanitizeText,
} from './sanitize';