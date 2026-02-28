"use client";

import React, { useState, useCallback } from "react";
import { FileDropzone } from "@/components/ui/file-dropzone";

interface UploadedDoc {
  id: string;
  filename: string;
  fileType: string;
  contentLength: number;
  createdAt: string;
}

interface FlowUploadPanelProps {
  projectId: string;
  documents: UploadedDoc[];
  onDocumentsChange: () => void;
  disabled?: boolean;
}

export function FlowUploadPanel({ projectId, documents, onDocumentsChange, disabled }: FlowUploadPanelProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    setUploading(true);
    setError(null);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", projectId);

        const res = await fetch("/api/bottleneck/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "アップロードに失敗しました");
        }
      }
      onDocumentsChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードエラー");
    } finally {
      setUploading(false);
    }
  }, [projectId, onDocumentsChange]);

  const handleDelete = useCallback(async (docId: string) => {
    try {
      const res = await fetch("/api/bottleneck/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: docId }),
      });
      if (res.ok) {
        onDocumentsChange();
      }
    } catch {
      // ignore
    }
  }, [onDocumentsChange]);

  const fileTypeIcon = (type: string) => {
    switch (type) {
      case "pdf": return "PDF";
      case "docx": return "DOC";
      case "pptx": return "PPT";
      case "csv": return "CSV";
      case "xlsx": return "XLS";
      default: return "TXT";
    }
  };

  return (
    <div className="space-y-4">
      <FileDropzone
        accept=".pdf,.docx,.pptx,.csv,.txt,.md,.json"
        multiple
        onFilesSelected={handleFilesSelected}
        uploading={uploading}
        disabled={disabled}
        label="業務フロードキュメントをアップロード"
        helperText="対応形式: PDF, DOCX, PPTX, CSV, TXT, MD, JSON"
        featureText="業務マニュアル・手順書・フロー図などをアップロードしてください"
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Uploaded files list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            アップロード済み ({documents.length}件)
          </h4>
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-bold px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  {fileTypeIcon(doc.fileType)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{doc.filename}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {doc.contentLength.toLocaleString()}文字
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                title="削除"
              >
                <svg className="w-4 h-4 text-slate-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
