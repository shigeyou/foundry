"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import type { FinderConfig, DrafterConfig, SimulatorConfig } from "@foundry/core/types";
import { ThemeToggle } from "@/components/theme-toggle";

interface ToolsData {
  finders: FinderConfig[];
  drafters: DrafterConfig[];
  simulators: SimulatorConfig[];
  total: number;
}

const appTypes = [
  {
    key: "kachisuji" as const,
    icon: "🔍",
    label: "勝ち筋ファインダー",
    description: "企業の課題と勝ち筋をAIで探索",
    gradient: "from-blue-500 via-blue-600 to-indigo-600",
    lightBg: "bg-blue-100 dark:bg-blue-500/10",
    cardBg: "bg-blue-50 dark:bg-slate-900/80",
    border: "border-blue-200 dark:border-blue-500/30",
    shadow: "shadow-blue-200/50 dark:shadow-blue-500/20",
    textColor: "text-blue-700 dark:text-blue-300",
    directHref: "/meta-finder",
  },
  {
    key: "drafter" as const,
    icon: "📝",
    label: "ドラフター型",
    description: "文書やレポートを自動生成",
    gradient: "from-emerald-500 via-green-500 to-teal-600",
    lightBg: "bg-emerald-100 dark:bg-emerald-500/10",
    cardBg: "bg-emerald-50 dark:bg-slate-900/80",
    border: "border-emerald-200 dark:border-emerald-500/30",
    shadow: "shadow-emerald-200/50 dark:shadow-emerald-500/20",
    textColor: "text-emerald-700 dark:text-emerald-300",
    href: "/drafter",
  },
  {
    key: "simulator" as const,
    icon: "🔮",
    label: "シミュレーター型",
    description: "シナリオ分析・将来予測",
    gradient: "from-purple-500 via-violet-500 to-fuchsia-600",
    lightBg: "bg-purple-100 dark:bg-purple-500/10",
    cardBg: "bg-purple-50 dark:bg-slate-900/80",
    border: "border-purple-200 dark:border-purple-500/30",
    shadow: "shadow-purple-200/50 dark:shadow-purple-500/20",
    textColor: "text-purple-700 dark:text-purple-300",
    href: "/simulator",
  },
];

export default function FoundryDashboard() {
  const [tools, setTools] = useState<ToolsData | null>(null);
  const [loading, setLoading] = useState(true);
  const kaedeUrl = process.env.NEXT_PUBLIC_KAEDE_URL;

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/tools");
        if (res.ok) {
          const data = await res.json();
          setTools(data);
        }
      } catch (err) {
        console.error("Failed to fetch tools:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getAppsForType = (type: "kachisuji" | "drafter" | "simulator") => {
    if (!tools) return [];
    switch (type) {
      case "drafter": return tools.drafters;
      case "simulator": return tools.simulators;
      default: return [];
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white overflow-hidden transition-colors duration-300">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-blue-400/20 dark:bg-blue-500/30 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-400/15 dark:bg-indigo-500/20 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-sky-400/15 dark:bg-sky-500/20 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: "2s" }} />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <header className="relative pt-4 pb-8 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-10 py-4 px-6 -mx-6 bg-gradient-to-r from-blue-50/80 via-white/50 to-indigo-50/80 dark:from-blue-950/50 dark:via-slate-900/50 dark:to-indigo-950/50 backdrop-blur-sm border-b border-blue-100 dark:border-blue-900/50">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/40 hover:shadow-blue-500/60 transition-shadow duration-300 overflow-hidden">
                  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                    <defs>
                      <linearGradient id="flameHeroOuter" x1="0.5" y1="1" x2="0.5" y2="0">
                        <stop offset="0%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#ef4444" />
                      </linearGradient>
                      <linearGradient id="flameHeroInner" x1="0.5" y1="1" x2="0.5" y2="0">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#f97316" />
                      </linearGradient>
                    </defs>
                    <rect x="15" y="4" width="4" height="7" rx="0.5" fill="white" opacity="0.3" />
                    <path d="M15 4h4v7h-4V4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 12l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="5" y="12" width="14" height="9" fill="white" opacity="0.15" />
                    <path d="M5 12v9h14v-9" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8 21v-5a4 4 0 0 1 8 0v5" stroke="white" strokeWidth="1.5" fill="rgba(0,0,0,0.3)" />
                    <path d="M10 20.5c0-2.5 1-3.5 2-5 1 1.5 2 2.5 2 5" fill="url(#flameHeroOuter)" stroke="none" />
                    <path d="M11 20.5c0-1.5 0.5-2 1-3 0.5 1 1 1.5 1 3" fill="url(#flameHeroInner)" stroke="none" />
                  </svg>
                </div>
                <div className="absolute -inset-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl blur-2xl opacity-30 dark:opacity-50 animate-pulse" />
              </div>
              <div>
                <p className="text-base font-medium text-blue-600 dark:text-blue-400 mb-1">
                  企業の課題解決をAIで支援する、Foundry（鋳造所）
                </p>
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
                  <span className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 dark:from-blue-400 dark:via-blue-500 dark:to-indigo-400 bg-clip-text text-transparent drop-shadow-sm">
                    Foundry
                  </span>
                </h1>
              </div>
            </div>

            <div className="bg-slate-100 dark:bg-slate-800 backdrop-blur-sm rounded-full p-1.5 shadow-md border border-slate-200 dark:border-slate-700">
              <ThemeToggle />
            </div>
          </div>

          {/* Common Settings Card */}
          <div className="mb-8">
            <div className="relative bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl border-2 border-slate-200 dark:border-slate-700 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="w-10 h-10 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">全ツール共通</p>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">共通設定</h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/settings?tab=intro"
                    className="group/item flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:shadow-md transition-all"
                  >
                    <span className="text-lg">📖</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover/item:text-slate-900 dark:group-hover/item:text-white">はじめに</span>
                  </Link>
                  <Link
                    href="/settings?tab=company"
                    className="group/item flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:shadow-md transition-all"
                  >
                    <span className="text-lg">🏢</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover/item:text-slate-900 dark:group-hover/item:text-white">対象企業</span>
                  </Link>
                  <Link
                    href="/settings?tab=rag"
                    className="group/item flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:shadow-md transition-all"
                  >
                    <span className="text-lg">📚</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover/item:text-slate-900 dark:group-hover/item:text-white">RAG情報</span>
                  </Link>
                  <Link
                    href="/settings?tab=swot"
                    className="group/item flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:shadow-md transition-all"
                  >
                    <span className="text-lg">📊</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover/item:text-slate-900 dark:group-hover/item:text-white">SWOT</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* App Type Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {appTypes.map((type, index) => {
              const apps = "directHref" in type ? [] : getAppsForType(type.key as "drafter" | "simulator");
              return (
                <div
                  key={type.key}
                  className="group relative"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <div className="relative bg-white dark:bg-slate-900 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-700 p-5 transition-all duration-500 hover:shadow-xl">
                    <div className="relative flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-2xl">{type.icon}</span>
                      <span className={`text-sm font-semibold ${type.textColor} tracking-wide`}>{type.label}</span>
                    </div>

                    <div className="relative space-y-3 min-h-[120px]">
                      {"directHref" in type ? (
                        <Link
                          href={type.directHref!}
                          className={`block px-4 py-4 bg-gradient-to-r ${type.gradient} rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group/item`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-base font-bold text-white">{type.label}</span>
                            <svg className="w-5 h-5 text-white/70 group-hover/item:text-white group-hover/item:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      ) : loading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-slate-600 dark:border-t-slate-300 rounded-full animate-spin" />
                        </div>
                      ) : apps.length > 0 ? (
                        apps.map((app) => (
                          <Link
                            key={app.id}
                            href={`/${type.key}/${app.id}`}
                            className={`block px-4 py-4 bg-gradient-to-r ${type.gradient} rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group/item`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-base font-bold text-white">
                                {app.name}
                              </span>
                              <svg className="w-5 h-5 text-white/70 group-hover/item:text-white group-hover/item:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </Link>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                            <svg className="w-6 h-6 text-slate-400 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                          </div>
                          <p className="text-sm text-slate-400 dark:text-slate-500">アプリ未登録</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 連携アプリ */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1 h-5 bg-teal-500 rounded"></span>
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">連携アプリ</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 transition-all duration-500 hover:shadow-xl">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-2xl">🤖</span>
                  <span className="text-sm font-semibold text-teal-700 dark:text-teal-300 tracking-wide">AIアバターアシスタント</span>
                </div>
                <div className="space-y-3 min-h-[80px]">
                  {kaedeUrl ? (
                    <a
                      href={kaedeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-4 py-4 bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group/item"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-white">かえで</span>
                        <svg className="w-5 h-5 text-white/70 group-hover/item:text-white group-hover/item:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </div>
                      <p className="text-xs text-white/70 mt-1">VRアバターとのAI会話</p>
                    </a>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <p className="text-sm text-slate-400 dark:text-slate-500">URL未設定</p>
                      <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">NEXT_PUBLIC_KAEDE_URL</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </header>

      <footer className="relative py-12 text-center">
        <p className="text-sm text-slate-400 dark:text-slate-600">
          商船三井マリテックス株式会社
        </p>
      </footer>
    </div>
  );
}
