// ファイル種類判定・変換ユーティリティ（クライアントサイド）

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"];
const DOCUMENT_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt", ".md", ".json", ".msg", ".eml"];
const SPREADSHEET_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".webm", ".ogg", ".flac", ".aac"];

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : "";
}

export type FileCategory = "image" | "document" | "spreadsheet" | "audio" | "unknown";

export function getFileCategory(fileName: string): FileCategory {
  const ext = getExtension(fileName);
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (DOCUMENT_EXTENSIONS.includes(ext)) return "document";
  if (SPREADSHEET_EXTENSIONS.includes(ext)) return "spreadsheet";
  if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
  return "unknown";
}

export function isImageFile(fileName: string): boolean {
  return getFileCategory(fileName) === "image";
}

export function isDocumentFile(fileName: string): boolean {
  return getFileCategory(fileName) === "document";
}

export function isSpreadsheetFile(fileName: string): boolean {
  return getFileCategory(fileName) === "spreadsheet";
}

export function isAudioFile(fileName: string): boolean {
  return getFileCategory(fileName) === "audio";
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function getMimeType(fileName: string): string {
  const ext = getExtension(fileName);
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
  };
  return map[ext] || "application/octet-stream";
}

export const ACCEPTED_FILE_TYPES = [
  ...IMAGE_EXTENSIONS,
  ...DOCUMENT_EXTENSIONS,
  ...SPREADSHEET_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
].join(",");

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
