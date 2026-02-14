"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface HomeButtonProps {
  variant?: "default" | "compact" | "text";
  className?: string;
}

export function HomeButton({ variant = "default", className }: HomeButtonProps) {
  if (variant === "text") {
    return (
      <Link
        href="/"
        className={cn(
          "inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors group",
          className
        )}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {/* 煙突 */}
          <rect x="15" y="4" width="4" height="7" rx="0.5" fill="currentColor" opacity="0.3" />
          <path d="M15 4h4v7h-4V4" strokeLinecap="round" strokeLinejoin="round" />
          {/* 三角屋根 */}
          <path d="M3 12l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
          {/* 建物 */}
          <rect x="5" y="12" width="14" height="9" fill="currentColor" opacity="0.2" />
          <path d="M5 12v9h14v-9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-sm font-medium group-hover:-translate-x-0.5 transition-transform">← 戻る</span>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link
        href="/"
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg transition-all group",
          className
        )}
      >
        <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {/* 煙突 */}
            <rect x="15" y="4" width="4" height="7" rx="0.5" fill="currentColor" opacity="0.3" />
            <path d="M15 4h4v7h-4V4" strokeLinecap="round" strokeLinejoin="round" />
            {/* 三角屋根 */}
            <path d="M3 12l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
            {/* 建物 */}
            <rect x="5" y="12" width="14" height="9" fill="currentColor" opacity="0.2" />
            <path d="M5 12v9h14v-9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300 group-hover:-translate-x-0.5 transition-transform">← 戻る</span>
      </Link>
    );
  }

  // Default variant - most prominent
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 group hover:-translate-y-0.5",
        className
      )}
    >
      <div className="relative">
        <div className="w-7 h-7 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {/* 煙突 */}
            <rect x="15" y="4" width="4" height="7" rx="0.5" fill="currentColor" opacity="0.3" />
            <path d="M15 4h4v7h-4V4" strokeLinecap="round" strokeLinejoin="round" />
            {/* 三角屋根 */}
            <path d="M3 12l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
            {/* 建物 */}
            <rect x="5" y="12" width="14" height="9" fill="currentColor" opacity="0.2" />
            <path d="M5 12v9h14v-9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <span className="text-sm font-bold group-hover:-translate-x-0.5 transition-transform">← 戻る</span>
    </Link>
  );
}
