/**
 * Utilities for handling files and filenames
 */

/**
 * Sanitize a filename to be safe for S3 and URLs
 * - Removes special characters
 * - Replaces spaces with underscores
 * - Adds timestamp to ensure uniqueness
 */
export const sanitizeFilename = (filename: string): string => {
  // Get file extension
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  // Generate a short random string
  const randomStr = Math.random().toString(36).substring(2, 8);
  
  // Get timestamp (YYMMDD)
  const timestamp = new Date().toISOString()
    .replace(/[^0-9]/g, '')
    .slice(2, 8);  // YYMMDD
  
  // Create a short, unique filename
  return `img_${timestamp}_${randomStr}.${ext}`;
};

/**
 * Get a file's mime type from its extension
 */
export const getMimeType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: { [key: string]: string } = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'heic': 'image/heic',
    'heif': 'image/heif',
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};