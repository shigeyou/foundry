import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, helperText, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors",
            "placeholder:text-slate-400 dark:placeholder:text-slate-500",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "dark:bg-slate-700 dark:text-slate-100",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
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
Input.displayName = "Input";

export { Input };
