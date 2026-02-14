"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface FileDropzoneProps {
  /** Accepted file types (e.g., ".pdf,.txt,.docx") */
  accept?: string;
  /** Allow multiple files */
  multiple?: boolean;
  /** Callback when files are selected */
  onFilesSelected: (files: File[]) => void;
  /** Whether upload is in progress */
  uploading?: boolean;
  /** Upload progress (0-100) */
  progress?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Custom label text */
  label?: string;
  /** Helper text showing accepted formats */
  helperText?: string;
  /** Feature highlight text (displayed prominently) */
  featureText?: string;
  /** Additional className */
  className?: string;
  /** Compact mode for inline usage */
  compact?: boolean;
}

export function FileDropzone({
  accept,
  multiple = false,
  onFilesSelected,
  uploading = false,
  progress = 0,
  disabled = false,
  label = "ファイルをドラッグ&ドロップ または Ctrl+V でペースト",
  helperText,
  featureText,
  className,
  compact = false,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropzoneRef = React.useRef<HTMLDivElement>(null);

  // テキストペースト対応
  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled || uploading) return;

      const text = e.clipboardData?.getData("text/plain");
      if (text && text.trim()) {
        e.preventDefault();
        const blob = new Blob([text], { type: "text/plain" });
        const file = new File([blob], "pasted-content.txt", { type: "text/plain" });
        console.log("Created file from paste:", file.name, file.size);
        onFilesSelected([file]);
      }
    };

    const element = dropzoneRef.current;
    if (element) {
      element.addEventListener("paste", handlePaste);
      return () => element.removeEventListener("paste", handlePaste);
    }
  }, [disabled, uploading, onFilesSelected]);

  const handleDragOver = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !uploading) {
        setIsDragOver(true);
      }
    },
    [disabled, uploading]
  );

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled || uploading) return;

      // デバッグ: dataTransferの全内容を出力
      console.log("=== Drop Event Debug ===");
      console.log("files:", e.dataTransfer.files.length, Array.from(e.dataTransfer.files).map(f => ({ name: f.name, type: f.type, size: f.size })));
      console.log("types:", e.dataTransfer.types);
      console.log("items:", e.dataTransfer.items?.length);

      // 全てのデータタイプを確認
      for (const type of e.dataTransfer.types) {
        const data = e.dataTransfer.getData(type);
        console.log(`getData("${type}"):`, data?.substring(0, 500));
      }

      let droppedFiles = Array.from(e.dataTransfer.files);

      // Outlookから直接ドラッグした場合の処理
      if (droppedFiles.length === 0) {
        // Outlook Web/New Outlook形式を検出
        if (e.dataTransfer.types.includes("multimaillistmessagerows")) {
          const outlookData = e.dataTransfer.getData("multimaillistmessagerows");
          try {
            const parsed = JSON.parse(outlookData);
            const subjects = parsed.subjects || [];
            const subject = subjects[0] || "Outlookメール";

            // 件名を含むプレースホルダーファイルを作成
            const content = `【Outlookメールから取得】\n\n件名: ${subject}\n\n※メール本文はOutlookのセキュリティ制限により自動取得できません。\n以下のいずれかの方法でメール内容を取得してください：\n\n1. Outlookでメールを開き、本文をコピーしてこの欄にペースト\n2. メールを右クリック →「名前を付けて保存」で.msgファイルとして保存 → ファイルをドラッグ`;

            const blob = new Blob([content], { type: "text/plain" });
            // ファイル名から不正な文字を除去
            const safeName = subject.substring(0, 50).replace(/[\\/:*?"<>|]/g, "_");
            const file = new File([blob], `${safeName || "outlook-mail"}.txt`, { type: "text/plain" });
            console.log("Created Outlook file:", file.name, file.size);
            onFilesSelected([file]);
            return;
          } catch (err) {
            console.error("Failed to parse Outlook data:", err);
          }
        }

        // その他のitemsからデータを取得
        if (e.dataTransfer.items) {
          const items = Array.from(e.dataTransfer.items);
          console.log("DataTransfer items:", items.map(i => ({ kind: i.kind, type: i.type })));

          // テキストデータがある場合
          const textItem = items.find(item => item.kind === "string" && item.type === "text/plain");
          if (textItem) {
            textItem.getAsString((text) => {
              if (text && text.trim()) {
                const blob = new Blob([text], { type: "text/plain" });
                const file = new File([blob], "dropped-text.txt", { type: "text/plain" });
                onFilesSelected([file]);
              }
            });
            return;
          }

          // ファイルアイテムを取得
          for (const item of items) {
            if (item.kind === "file") {
              const file = item.getAsFile();
              if (file) {
                droppedFiles.push(file);
              }
            }
          }
        }
      }

      // Filter by accepted types if specified
      const filteredFiles = accept
        ? droppedFiles.filter((file) => {
            const acceptedTypes = accept.split(",").map((t) => t.trim().toLowerCase());
            const fileExt = `.${file.name.split(".").pop()?.toLowerCase()}`;
            const fileMime = file.type.toLowerCase();
            // Outlookから直接ドラッグした場合、拡張子がない場合があるので許容
            const hasNoExtension = !file.name.includes(".");
            return acceptedTypes.some(
              (type) => type === fileExt || type === fileMime || type === "*"
            ) || hasNoExtension;
          })
        : droppedFiles;

      if (filteredFiles.length > 0) {
        onFilesSelected(multiple ? filteredFiles : [filteredFiles[0]]);
      } else if (droppedFiles.length > 0) {
        // フィルタで弾かれた場合、デバッグ用にログ出力
        console.log("Files dropped but filtered out:", droppedFiles.map(f => ({ name: f.name, type: f.type })));
      }
    },
    [accept, disabled, multiple, onFilesSelected, uploading]
  );

  const handleClick = React.useCallback(() => {
    if (!disabled && !uploading) {
      inputRef.current?.click();
    }
  }, [disabled, uploading]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && !disabled && !uploading) {
        e.preventDefault();
        inputRef.current?.click();
      }
    },
    [disabled, uploading]
  );

  const handleFileChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFilesSelected(Array.from(files));
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [onFilesSelected]
  );

  const isDisabled = disabled || uploading;

  return (
    <div
      ref={dropzoneRef}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-label={label}
      aria-disabled={isDisabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200",
        compact ? "p-3" : "p-6",
        isDragOver
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
          : "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50",
        !isDisabled && "cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10",
        isDisabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        disabled={isDisabled}
        className="hidden"
        aria-hidden="true"
      />

      {uploading ? (
        <div className="flex flex-col items-center gap-2 w-full">
          <div className="flex items-center gap-2">
            <svg
              className="animate-spin h-5 w-5 text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              アップロード中...
            </span>
          </div>
          {progress > 0 && (
            <div className="w-full max-w-xs">
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1">
                {Math.round(progress)}%
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          {!compact && (
            <div className="mb-2">
              <svg
                className={cn(
                  "w-8 h-8 transition-colors",
                  isDragOver
                    ? "text-blue-500"
                    : "text-slate-400 dark:text-slate-500"
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
          )}

          <p
            className={cn(
              "font-medium text-center",
              compact ? "text-xs" : "text-sm",
              isDragOver
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-700 dark:text-slate-300"
            )}
          >
            {isDragOver ? "ここにドロップ" : label}
          </p>

          {!compact && helperText && (
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1">
              {helperText}
            </p>
          )}

          {!compact && featureText && (
            <p className="text-sm font-bold text-center mt-3 py-2 px-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 rounded-lg text-blue-600 dark:text-blue-300">
              {featureText}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// Inline variant for textarea accompaniment
export interface FileDropzoneInlineProps {
  accept?: string;
  onFileSelected: (file: File) => void;
  uploading?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function FileDropzoneInline({
  accept,
  onFileSelected,
  uploading = false,
  disabled = false,
  label = "ファイルを添付",
  className,
}: FileDropzoneInlineProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!disabled && !uploading) {
      inputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
    e.target.value = "";
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || uploading}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors",
        "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800",
        "text-slate-600 dark:text-slate-300",
        "hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        className
      )}
      aria-label={label}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled || uploading}
        className="hidden"
        aria-hidden="true"
      />
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
        />
      </svg>
      {uploading ? "読み込み中..." : label}
    </button>
  );
}
