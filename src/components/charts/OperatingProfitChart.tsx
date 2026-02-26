"use client";

import { useMemo } from "react";
import { departmentFinancials, type DeptFinancial } from "@/config/department-financials";

const EXCLUDED_DEPTS = ["planning", "hr", "finance"];

function formatM(v: number): string {
  if (v === 0) return "0";
  const m = Math.round(v / 1000);
  return m > 0 ? `+${m}M` : `${m}M`;
}

function BarPair({
  d,
  maxPos,
  maxNeg,
  locale,
}: {
  d: DeptFinancial;
  maxPos: number;
  maxNeg: number;
  locale: string;
}) {
  const isAll = d.deptId === "all";
  const pos25 = d.fy25OperatingProfit >= 0;
  const pos26 = d.fy26OperatingProfit >= 0;
  // 0基準の位置(%)。赤字幅に応じた最小限のスペースを左に確保
  const negPct = maxNeg > 0 ? (maxNeg / (maxPos + maxNeg)) * 100 : 0;
  const zeroPct = Math.max(negPct, 2); // 最低2%は確保
  // バー幅: 正はmaxPos基準、負はmaxNeg基準で、それぞれの側100%を使い切る
  const barPct25 = pos25
    ? (d.fy25OperatingProfit / maxPos) * (100 - zeroPct)
    : maxNeg > 0 ? (Math.abs(d.fy25OperatingProfit) / maxNeg) * zeroPct : 0;
  const barPct26 = pos26
    ? (d.fy26OperatingProfit / maxPos) * (100 - zeroPct)
    : maxNeg > 0 ? (Math.abs(d.fy26OperatingProfit) / maxNeg) * zeroPct : 0;

  return (
    <div className={`group relative flex items-center gap-2 py-[3px] px-2 rounded transition-colors hover:bg-gray-100/60 dark:hover:bg-white/5 ${isAll ? "bg-gray-100/80 dark:bg-white/[0.07] py-1" : ""}`}>
      {/* 部門名 */}
      <div className="w-[160px] shrink-0 text-right">
        <span
          className={`inline-block leading-none ${
            isAll
              ? "text-[16px] font-extrabold text-indigo-700 dark:text-indigo-300"
              : "text-[14px] font-bold text-gray-800 dark:text-gray-100"
          }`}
        >
          {d.budgetDeptName}
        </span>
      </div>

      {/* バーエリア */}
      <div className="flex-1 min-w-0">
        {/* FY25 */}
        <div className="flex items-center h-[14px]">
          <div className="relative w-full h-full">
            <div className="absolute top-0 bottom-0 w-px bg-gray-300 dark:bg-gray-600" style={{ left: `${zeroPct}%` }} />
            <div
              className="absolute top-[1px] h-[12px] rounded-sm"
              style={{
                width: `${barPct25}%`,
                ...(pos25
                  ? { left: `${zeroPct}%`, background: isAll ? "#2563eb" : "#60a5fa" }
                  : { left: `${zeroPct - barPct25}%`, background: isAll ? "#2563eb" : "#93c5fd" }),
              }}
            />
          </div>
          <span className={`ml-1.5 shrink-0 w-[44px] text-right text-[10px] leading-none font-mono tabular-nums ${pos25 ? "text-blue-600 dark:text-blue-400" : "text-red-500 dark:text-red-400"}`}>
            {formatM(d.fy25OperatingProfit)}
          </span>
        </div>
        {/* FY26 */}
        <div className="flex items-center h-[14px]">
          <div className="relative w-full h-full">
            <div className="absolute top-0 bottom-0 w-px bg-gray-300 dark:bg-gray-600" style={{ left: `${zeroPct}%` }} />
            <div
              className="absolute top-[1px] h-[12px] rounded-sm"
              style={{
                width: `${barPct26}%`,
                ...(pos26
                  ? { left: `${zeroPct}%`, background: isAll ? "#7c3aed" : "#a78bfa" }
                  : { left: `${zeroPct - barPct26}%`, background: isAll ? "#7c3aed" : "#c4b5fd" }),
              }}
            />
          </div>
          <span className={`ml-1.5 shrink-0 w-[44px] text-right text-[10px] leading-none font-mono tabular-nums ${pos26 ? "text-purple-600 dark:text-purple-400" : "text-red-500 dark:text-red-400"}`}>
            {formatM(d.fy26OperatingProfit)}
          </span>
        </div>
      </div>

      {/* YoY変化インジケータ */}
      <div className="w-[48px] shrink-0 text-center">
        {d.profitStatus !== "na" && (() => {
          const diff = d.fy26OperatingProfit - d.fy25OperatingProfit;
          const diffM = Math.round(diff / 1000);
          const up = diff > 0;
          return (
            <span className={`text-[11px] font-bold ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
              {up ? "\u25B2" : "\u25BC"}{Math.abs(diffM)}M
            </span>
          );
        })()}
      </div>
    </div>
  );
}

export default function OperatingProfitChart({ locale = "ja" }: { locale?: string }) {
  const filtered = useMemo(
    () => departmentFinancials.filter((d) => !EXCLUDED_DEPTS.includes(d.deptId)),
    []
  );

  const maxPos = useMemo(
    () => Math.max(1, ...filtered.map((d) => Math.max(d.fy25OperatingProfit, d.fy26OperatingProfit, 0))),
    [filtered]
  );
  const maxNeg = useMemo(
    () => Math.max(0, ...filtered.map((d) => Math.max(-d.fy25OperatingProfit, -d.fy26OperatingProfit, 0))),
    [filtered]
  );

  const title = locale === "en"
    ? "Operating Profit by Department"
    : "部門別 営業損益";
  const subtitle = locale === "en"
    ? "FY25 Forecast vs FY26 Budget (thousands \u00A5)"
    : "FY25 着地見込 vs FY26 期初予算（千円）";

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* ヘッダー */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {subtitle}
        </p>
      </div>

      {/* 凡例 */}
      <div className="flex items-center justify-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-blue-400" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            {locale === "en" ? "FY25 Forecast" : "FY25 着地見込"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-purple-400" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            {locale === "en" ? "FY26 Budget" : "FY26 期初予算"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {locale === "en" ? "▲▼ YoY change" : "▲▼ 前年比"}
          </span>
        </div>
      </div>

      {/* グラフ本体 */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur divide-y-4 divide-gray-200 dark:divide-gray-600/50 overflow-hidden">
        {filtered.map((d) => (
          <BarPair key={d.deptId} d={d} maxPos={maxPos} maxNeg={maxNeg} locale={locale} />
        ))}
      </div>

      {/* 注記 */}
      <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-3">
        {locale === "en"
          ? "* FY25 figures are unconfirmed forecasts; FY26 figures are initial budget projections"
          : "※ FY25は着地見込み（未確定）、FY26は期初予算（予測値）。いずれも実績確定値ではありません"}
      </p>
    </div>
  );
}

// PDF出力用スタンドアロンHTML
export function getOperatingProfitChartHtml(): string {
  const filtered = departmentFinancials.filter(
    (d) => !EXCLUDED_DEPTS.includes(d.deptId)
  );
  const maxAbs = Math.max(...filtered.map((d) => Math.max(Math.abs(d.fy25OperatingProfit), Math.abs(d.fy26OperatingProfit))));
  const scale = maxAbs > 0 ? 280 / maxAbs : 1;

  const barRow = (d: typeof filtered[0]) => {
    const fy25Width = Math.abs(d.fy25OperatingProfit) * scale;
    const fy26Width = Math.abs(d.fy26OperatingProfit) * scale;
    const pos25 = d.fy25OperatingProfit >= 0;
    const pos26 = d.fy26OperatingProfit >= 0;
    const isAll = d.deptId === "all";
    const fy25Color = isAll ? "#2563eb" : "#60a5fa";
    const fy26Color = isAll ? "#7c3aed" : "#a78bfa";
    const fy25Lbl = `${d.fy25OperatingProfit > 0 ? "+" : ""}${Math.round(d.fy25OperatingProfit / 1000)}M`;
    const fy26Lbl = `${d.fy26OperatingProfit > 0 ? "+" : ""}${Math.round(d.fy26OperatingProfit / 1000)}M`;
    const diff = d.fy26OperatingProfit - d.fy25OperatingProfit;
    const diffM = Math.round(diff / 1000);
    const yoyColor = diff >= 0 ? "#059669" : "#dc2626";
    const yoyStr = d.profitStatus === "na" ? "" : `<span style="color:${yoyColor};font-size:10px;font-weight:bold;">${diff >= 0 ? "▲" : "▼"}${Math.abs(diffM)}M</span>`;
    const bg = isAll ? "#f0f4ff" : "transparent";
    const nameStyle = isAll
      ? "font-size:16px;font-weight:800;color:#4338ca;"
      : "font-size:14px;font-weight:700;color:#1e293b;";

    return `
      <tr style="background:${bg};">
        <td style="padding:4px 8px;text-align:right;white-space:nowrap;width:150px;${nameStyle}">${d.budgetDeptName}</td>
        <td style="padding:3px 4px;position:relative;width:580px;">
          <div style="position:relative;height:28px;">
            <div style="position:absolute;left:290px;top:0;bottom:0;width:1px;background:#cbd5e1;"></div>
            <div style="position:absolute;top:1px;height:12px;${pos25 ? `left:290px;width:${fy25Width}px;` : `left:${290 - fy25Width}px;width:${fy25Width}px;`}background:${fy25Color};border-radius:2px;"></div>
            <span style="position:absolute;top:1px;${pos25 ? `left:${294 + fy25Width}px;` : `left:${284 - fy25Width}px;text-align:right;`}font-size:9px;color:${fy25Color};font-weight:600;">${fy25Lbl}</span>
            <div style="position:absolute;top:14px;height:12px;${pos26 ? `left:290px;width:${fy26Width}px;` : `left:${290 - fy26Width}px;width:${fy26Width}px;`}background:${fy26Color};border-radius:2px;"></div>
            <span style="position:absolute;top:14px;${pos26 ? `left:${294 + fy26Width}px;` : `left:${284 - fy26Width}px;text-align:right;`}font-size:9px;color:${fy26Color};font-weight:600;">${fy26Lbl}</span>
          </div>
        </td>
        <td style="padding:4px 6px;text-align:center;width:50px;">${yoyStr}</td>
      </tr>
    `;
  };

  return `
    <div style="padding:24px;background:white;font-family:'Hiragino Sans','Yu Gothic','Meiryo',sans-serif;color:#1a1a1a;">
      <h2 style="font-size:18px;font-weight:800;text-align:center;margin:0 0 4px;color:#1e293b;">部門別 営業損益</h2>
      <p style="font-size:11px;color:#64748b;text-align:center;margin:0 0 16px;">FY25 着地見込 vs FY26 期初予算（千円）</p>
      <div style="display:flex;gap:20px;justify-content:center;margin-bottom:12px;">
        <span style="font-size:11px;font-weight:600;"><span style="display:inline-block;width:12px;height:8px;background:#60a5fa;border-radius:2px;margin-right:4px;vertical-align:middle;"></span>FY25 着地見込</span>
        <span style="font-size:11px;font-weight:600;"><span style="display:inline-block;width:12px;height:8px;background:#a78bfa;border-radius:2px;margin-right:4px;vertical-align:middle;"></span>FY26 期初予算</span>
        <span style="font-size:10px;color:#6b7280;">▲▼ 前年比</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${filtered.map(barRow).join("")}</tbody>
      </table>
      <p style="font-size:9px;color:#94a3b8;text-align:center;margin:10px 0 0;">※FY25は着地見込み（未確定）、FY26は期初予算（予測値）</p>
    </div>
  `;
}
