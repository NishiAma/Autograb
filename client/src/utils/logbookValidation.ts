/** Must match the server's MAX_LOGBOOK_SIZE_BYTES; the server remains the authority. */
export const MAX_LOGBOOK_SIZE_BYTES = 1024 * 1024;
export const ACCEPTED_LOGBOOK_TYPES = '.txt,text/plain';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Fast, friendly feedback before upload. Returns an error message, or null if
 * the file looks acceptable. This is a UX aid only: the server re-validates.
 */
export function validateLogbookFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.txt')) {
    return `"${file.name}" is not a .txt file. Please choose a plain text logbook.`;
  }
  // Some browsers/OSes report an empty type for .txt files, so only reject a known non-text type.
  if (file.type !== '' && file.type !== 'text/plain') {
    return `"${file.name}" does not appear to be plain text.`;
  }
  if (file.size === 0) {
    return `"${file.name}" is empty.`;
  }
  if (file.size > MAX_LOGBOOK_SIZE_BYTES) {
    return `"${file.name}" is ${formatFileSize(file.size)}. The maximum size is ${formatFileSize(MAX_LOGBOOK_SIZE_BYTES)}.`;
  }
  return null;
}
