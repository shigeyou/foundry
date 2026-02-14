"use client";

import { useEffect, useRef, ReactNode } from "react";
import { Button } from "@/components/ui/button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: "default" | "destructive";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "確認",
  cancelLabel = "キャンセル",
  onConfirm,
  onCancel,
  variant = "default",
  loading = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Handle dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
      // Focus confirm button when dialog opens
      setTimeout(() => confirmButtonRef.current?.focus(), 0);
    } else {
      dialog.close();
    }
  }, [open]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      handleCancel();
    }
  };

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        handleCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleCancel = () => {
    if (loading) return;
    onCancel?.();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    if (loading) return;
    onConfirm();
  };

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 bg-transparent p-0 m-auto backdrop:bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6 animate-scale-in">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          {description && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>

        {/* Custom content */}
        {children && <div className="mb-4">{children}</div>}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmButtonRef}
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={loading}
            className={variant === "default" ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                処理中...
              </span>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

// Hook for easier dialog management
import { useState, useCallback } from "react";

export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<{
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "default" | "destructive";
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const confirm = useCallback(
    (options: {
      title: string;
      description?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      variant?: "default" | "destructive";
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfig({
          ...options,
          onConfirm: () => resolve(true),
        });
        setOpen(true);
      });
    },
    []
  );

  const handleConfirm = async () => {
    if (config?.onConfirm) {
      setLoading(true);
      try {
        await config.onConfirm();
      } finally {
        setLoading(false);
        setOpen(false);
        setConfig(null);
      }
    }
  };

  const handleCancel = () => {
    setOpen(false);
    setConfig(null);
  };

  const DialogComponent = config ? (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title={config.title}
      description={config.description}
      confirmLabel={config.confirmLabel}
      cancelLabel={config.cancelLabel}
      variant={config.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      loading={loading}
    />
  ) : null;

  return { confirm, DialogComponent };
}
