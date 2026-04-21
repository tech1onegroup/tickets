"use client";

import { useRef, useState } from "react";
import {
  Paperclip,
  Camera,
  X,
  FileText,
  ImageIcon,
  UploadCloud,
} from "lucide-react";

export interface AttachmentPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
  compact?: boolean;
  disabled?: boolean;
}

const ACCEPTED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const MAX_BYTES = 25 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPicker({
  files,
  onChange,
  max = 10,
  compact = false,
  disabled = false,
}: AttachmentPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = (picked: Iterable<File> | null) => {
    if (!picked) return;
    const incoming = Array.from(picked);
    if (incoming.length === 0) return;

    const next = [...files];
    const rejections: string[] = [];

    for (const f of incoming) {
      if (next.length >= max) {
        rejections.push(`Reached max ${max} files`);
        break;
      }
      if (!ACCEPTED_MIME.has(f.type)) {
        rejections.push(`${f.name}: unsupported type`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        rejections.push(`${f.name}: too large (max 25 MB)`);
        continue;
      }
      next.push(f);
    }

    setError(rejections.length ? rejections.join("; ") : null);
    if (next.length !== files.length) onChange(next);
  };

  const remove = (idx: number) => {
    const next = files.slice();
    next.splice(idx, 1);
    onChange(next);
    setError(null);
  };

  const atMax = files.length >= max;

  // Drag & drop
  const onDragOver = (e: React.DragEvent) => {
    if (disabled || atMax) return;
    e.preventDefault();
    e.stopPropagation();
    if (!dragging) setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only unset when the drag leaves the wrapper entirely
    if (e.currentTarget === e.target) setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    add(e.dataTransfer.files);
  };

  return (
    <div
      className="space-y-2"
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, i) => {
            const isImage = f.type.startsWith("image/");
            return (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm bg-white"
              >
                {isImage ? (
                  <ImageIcon className="h-4 w-4 text-gray-500" />
                ) : (
                  <FileText className="h-4 w-4 text-gray-500" />
                )}
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-xs text-gray-500">{formatSize(f.size)}</span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-gray-500 hover:text-red-600"
                  aria-label="Remove attachment"
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Drop zone + quick pickers */}
      <div
        className={`rounded-md border border-dashed transition-colors ${
          dragging
            ? "border-indigo-500 bg-indigo-50"
            : "border-gray-300 bg-transparent"
        } ${compact ? "px-3 py-2" : "px-3 py-3"}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled || atMax}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:border-gray-400 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Paperclip className="h-3.5 w-3.5" />
            {compact ? "Files" : "Attach files"}
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={disabled || atMax}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:border-gray-400 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Camera className="h-3.5 w-3.5" />
            {compact ? "Camera" : "Take photo"}
          </button>
          <span className="text-xs text-gray-500 inline-flex items-center gap-1">
            <UploadCloud className="h-3.5 w-3.5" />
            {dragging ? (
              <span className="font-medium text-indigo-700">
                Drop to attach
              </span>
            ) : compact ? (
              <span>or drag, drop, paste</span>
            ) : (
              <span>
                or drag &amp; drop, paste — PDF or image, up to {max} files, 25 MB each
              </span>
            )}
          </span>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function appendAttachmentsToFormData(fd: FormData, files: File[]) {
  for (const f of files) fd.append("files", f);
}

/**
 * Extract File objects from a ClipboardEvent. Useful for wiring paste handlers
 * on chat textareas so users can Ctrl/Cmd+V screenshots.
 */
export function filesFromClipboard(e: ClipboardEvent | React.ClipboardEvent): File[] {
  const items = (e as ClipboardEvent).clipboardData?.items || null;
  if (!items) return [];
  const out: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file") {
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}
