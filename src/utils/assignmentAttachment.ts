/**
 * Utility helpers for Task / Assignment Attachments & Submissions
 * Supports Links, Photos (JPG, PNG, WebP) with auto-compression, and Documents (PDF, DOCX, DOC)
 */

export type SubmissionFormatType = 'link' | 'photo' | 'document';

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageSource(urlOrData?: string, fileName?: string): boolean {
  if (!urlOrData && !fileName) return false;
  const s = `${urlOrData || ''} ${fileName || ''}`.toLowerCase();
  if (s.startsWith('data:image/')) return true;
  return /\.(jpg|jpeg|png|webp|gif|svg|avif)(\?|$)/i.test(s);
}

export function isPdfDocument(urlOrData?: string, fileName?: string): boolean {
  if (!urlOrData && !fileName) return false;
  const s = `${urlOrData || ''} ${fileName || ''}`.toLowerCase();
  if (s.startsWith('data:application/pdf')) return true;
  return /\.pdf(\?|$)/i.test(s);
}

export function isWordDocument(urlOrData?: string, fileName?: string): boolean {
  if (!urlOrData && !fileName) return false;
  const s = `${urlOrData || ''} ${fileName || ''}`.toLowerCase();
  return /\.(doc|docx|odt)(\?|$)/i.test(s);
}

/**
 * Strict Web URL validator preventing javascript:, data:, or malformed URI schemes.
 * Only allows valid https:// and http:// protocols to protect against stored XSS attacks.
 */
export function isSafeWebUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  try {
    const parsed = new URL(clean);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function detectSubmissionType(
  explicitType?: string,
  fileUrlOrData?: string,
  fileName?: string
): SubmissionFormatType {
  if (explicitType === 'photo' || explicitType === 'document' || explicitType === 'link') {
    return explicitType;
  }
  if (isImageSource(fileUrlOrData, fileName)) return 'photo';
  if (isPdfDocument(fileUrlOrData, fileName) || isWordDocument(fileUrlOrData, fileName)) return 'document';
  return 'link';
}

/**
 * Compresses an image client-side via Canvas to stay under ~300KB
 * ensuring fast loading and safe localStorage persistence
 */
export async function processImageUpload(file: File): Promise<{
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1200;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              name: file.name,
              size: file.size,
              type: file.type || 'image/jpeg',
              dataUrl: rawDataUrl,
            });
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          const estimatedSize = Math.round((compressedDataUrl.length * 3) / 4);

          resolve({
            name: file.name,
            size: estimatedSize,
            type: 'image/jpeg',
            dataUrl: compressedDataUrl,
          });
        } catch {
          resolve({
            name: file.name,
            size: file.size,
            type: file.type || 'image/jpeg',
            dataUrl: rawDataUrl,
          });
        }
      };
      img.onerror = () => {
        resolve({
          name: file.name,
          size: file.size,
          type: file.type || 'image/jpeg',
          dataUrl: rawDataUrl,
        });
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Reads document files (.pdf, .doc, .docx, .txt) as base64 Data URL
 */
export async function processDocumentUpload(file: File): Promise<{
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}> {
  return new Promise((resolve, reject) => {
    // Limit to 4MB for localStorage safety
    if (file.size > 4.5 * 1024 * 1024) {
      reject(new Error('Document file size exceeds 4MB. Please use a Google Drive link for larger documents.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read document file.'));
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      resolve({
        name: file.name,
        size: file.size,
        type: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'application/msword'),
        dataUrl,
      });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Trigger download or view of data URL or remote file
 */
export function openOrDownloadAttachment(dataUrlOrLink: string, fileName?: string): void {
  if (!dataUrlOrLink) return;

  try {
    const a = document.createElement('a');
    a.href = dataUrlOrLink;
    if (dataUrlOrLink.startsWith('http://') || dataUrlOrLink.startsWith('https://')) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    } else {
      a.download = fileName || (dataUrlOrLink.startsWith('data:image/') ? 'tugas_foto.jpg' : 'dokumen_tugas.pdf');
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.warn('Failed to open/download attachment:', err);
  }
}
