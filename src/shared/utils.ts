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
  // if (!filePath) {
  //   return 'No file selected';
  // }

  // if (!rootFolder) {
  //   return filePath;
  // }

  // try {
  //   // Convert to absolute paths for consistency
  //   const absoluteFile = path.resolve(filePath);
  //   const absoluteRoot = path.resolve(rootFolder);

  //   // Prepare for comparison
  //   const fileForCompare = process.platform === 'win32' ? absoluteFile.toLowerCase() : absoluteFile;
  //   const rootForCompare = process.platform === 'win32' ? absoluteRoot.toLowerCase() : absoluteRoot;

  //   // Ensure root ends with separator
  //   const rootWithSep = rootForCompare.endsWith(path.sep) ? rootForCompare : rootForCompare + path.sep;

  //   // Check if file is inside root
  //   if (!fileForCompare.startsWith(rootWithSep)) {
  //     return `A: ${absoluteFile}`;
  //   }

  //   // Extract portion after root
  //   const relativePortion = absoluteFile.slice(absoluteRoot.length);

  //   // Clean up: remove leading separator if present
  //   let result = relativePortion.replace(/^[\\/]+/, '');

  //   // Convert to forward slashes for UI consistency
  //   result = result.replace(/\\/g, '/');

  //   return result || '(root folder)';
  // } catch (err) {
  //   console.warn('Failed to compute relative path:', err);
  //   return filePath;
  // }
}