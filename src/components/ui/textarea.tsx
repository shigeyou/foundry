import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  helperText?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, helperText, ...props }, ref) => {
    return (
      <div className="w-full">
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors resize-none",
            "placeholder:text-slate-400 dark:placeholder:text-slate-500",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "dark:bg-slate-700 dark:text-slate-100",
            error
              ? "border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-500/20"
              : "border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500/20",
            className
          )}
          ref={ref}
          {...props}
        />
        {helperText && (
          <p
            className={cn(
              "mt-1 text-xs",
              error
                ? "text-red-600 dark:text-red-400"
                : "text-slate-500 dark:text-slate-400"
            )}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
