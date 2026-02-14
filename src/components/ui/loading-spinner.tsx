"use client";

import { cn } from "@/lib/utils";

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  color?: "primary" | "white" | "slate";
  className?: string;
  label?: string;
}

const sizeClasses = {
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-3",
  xl: "w-12 h-12 border-4",
};

const colorClasses = {
  primary: "border-emerald-200 dark:border-emerald-800 border-t-emerald-500 dark:border-t-emerald-400",
  white: "border-white/30 border-t-white",
  slate: "border-slate-200 dark:border-slate-700 border-t-slate-500 dark:border-t-slate-400",
};

export function LoadingSpinner({
  size = "md",
  color = "primary",
  className,
  label,
}: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          "rounded-full animate-spin",
          sizeClasses[size],
          colorClasses[color]
        )}
        role="status"
        aria-label={label || "Loading"}
      />
      {label && (
        <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      )}
    </div>
  );
}

// Full-page loading overlay
export function LoadingOverlay({
  label = "読み込み中...",
}: {
  label?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
      <LoadingSpinner size="xl" label={label} />
    </div>
  );
}

// Inline loading state for buttons or small areas
export function LoadingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}
