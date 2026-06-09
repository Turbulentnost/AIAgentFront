import type { Icon } from "@primer/octicons-react";
import { FileCodeIcon, FileIcon, FileMediaIcon, FileZipIcon } from "@primer/octicons-react";

const CODE_EXTENSIONS = new Set([
  "c",
  "cpp",
  "cs",
  "css",
  "go",
  "html",
  "java",
  "js",
  "jsx",
  "json",
  "kt",
  "md",
  "php",
  "py",
  "rb",
  "rs",
  "scss",
  "sh",
  "sql",
  "ts",
  "tsx",
  "vue",
  "xml",
  "yaml",
  "yml"
]);

const MEDIA_EXTENSIONS = new Set(["gif", "ico", "jpeg", "jpg", "png", "svg", "webp"]);

const ARCHIVE_EXTENSIONS = new Set(["7z", "gz", "rar", "tar", "zip"]);

export function getFileExtension(filename: string) {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0) return "";
  return filename.slice(dotIndex + 1).toLowerCase();
}

export function getGithubFileIconComponent(filename: string): Icon {
  const ext = getFileExtension(filename);
  if (CODE_EXTENSIONS.has(ext)) return FileCodeIcon;
  if (MEDIA_EXTENSIONS.has(ext)) return FileMediaIcon;
  if (ARCHIVE_EXTENSIONS.has(ext)) return FileZipIcon;
  return FileIcon;
}

export function getGithubFileIconColorClass(filename: string) {
  const ext = getFileExtension(filename) || "default";
  return `fileIcon_${ext}`;
}
