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