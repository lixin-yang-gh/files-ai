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
  if (!filePath) {
    return 'No file selected';
  }

  if (!rootFolder) {
    return filePath;
  }

  try {
    // Normalize both paths (handles / vs \, trailing slashes, etc.)
    const normalizedFile = path.normalize(filePath);
    const normalizedRoot = path.normalize(rootFolder);

    // Compute relative path
    let relative = path.relative(normalizedRoot, normalizedFile);

    // On Windows, path.relative can return path with ..\ — we usually want ./ style or clean name
    // Convert backslashes to forward slashes for consistency in UI
    relative = relative.replace(/\\/g, '/');

    // If result is empty, it means file is exactly the root (rare)
    if (relative === '' || relative === '.') {
      return '(root folder)';
    }

    // Remove leading ./ if present
    if (relative.startsWith('./')) {
      relative = relative.slice(2);
    }

    return relative || '(root)';
  } catch (err) {
    console.warn('Failed to compute relative path:', err);
    return filePath; // fallback
  }
}