"use client";

import { useState, useEffect, useMemo } from "react";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { AggregateReportContent } from "@/components/bottleneck/AggregateReportContent";
import type { DepartmentAggregate } from "@/lib/bottleneck-types";

// 部門タブ固定順序
const DEPARTMENT_ORDER = [
  "全社",
  "総合企画部",
  "人事総務部",
  "経理部",
  "海洋技術事業部",
  "海技訓練事業部",
  "海事業務部",
  "オンサイト事業部",
  "新造船PM事業本部",
];

export default function BottleneckAggregateReportPage() {
  const [summary, setSummary] = useState<DepartmentAggregate | null>(null);
  const [departments, setDepartments] = useState<DepartmentAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("全社");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/bottleneck/aggregate");
        if (!res.ok) throw new Error("集計データの取得に失敗しました");
        const data = await res.json();
        setSummary(data.summary);
        setDepartments(data.departments);
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // タブ: 固定順序で並べる
  const tabs = useMemo(() => {
    const result: { label: string; count: number }[] = [
      { label: "全社", count: summary?.projectCount || 0 },
    ];
    for (const dept of DEPARTMENT_ORDER) {
      if (dept === "全社") continue;
      const d = departments.find((x) => x.department === dept);
      if (d) result.push({ label: dept, count: d.projectCount });
    }
    // 固定順序にない部門を末尾追加
    for (const d of departments) {
      if (!DEPARTMENT_ORDER.includes(d.department)) {
        result.push({ label: d.department, count: d.projectCount });
      }
    }
    return result;
  }, [summary, departments]);

  // 現在のタブのデータ
  const currentData = useMemo(() => {
    if (activeTab === "全社") return summary;
    return departments.find((d) => d.department === activeTab) || null;
  }, [activeTab, summary, departments]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/bottleneck"
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">ボトルネックファインダー</span>
                <span className="text-slate-300 dark:text-slate-600">/</span>
                <h1 className="text-lg font-bold bg-gradient-to-r from-orange-600 to-amber-600 dark:from-orange-400 dark:to-amber-400 bg-clip-text text-transparent">
                  横断ボトルネック分析レポート
                </h1>
              </div>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Department tabs */}
      <div className="bg-white dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 sticky top-[57px] z-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex overflow-x-auto gap-1 py-2 scrollbar-thin">
            {tabs.map((tab) => (
              <button
                key={tab.label}
                onClick={() => setActiveTab(tab.label)}
                className={`whitespace-nowrap px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 ${
                  activeTab === tab.label
                    ? "bg-orange-500 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                {tab.label}
                <span className={`text-xs ${activeTab === tab.label ? "text-orange-100" : "text-slate-400 dark:text-slate-500"}`}>
                  ({tab.count})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-slate-300 dark:border-slate-600 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-500">{error}</p>
          </div>
        ) : !currentData || currentData.projectCount === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-500 dark:text-slate-400">
              {activeTab}の分析済みプロジェクトがありません
            </p>
          </div>
        ) : (
          <AggregateReportContent data={currentData} />
        )}
      </div>
    </div>
  );
}
