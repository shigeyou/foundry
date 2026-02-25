// 部門別財務データの静的マッピング（取締役会議案書FY26期初予算より）
// ※FY25 = 着地見込み（2026年2月時点の見込値、未確定）
// ※FY26 = 期初予算（2026年2月時点の予測値）
// いずれも実績確定値ではない点に注意

export interface DeptFinancial {
  deptId: string;
  budgetDeptName: string;       // 予算書上の部門名
  fy26OperatingProfit: number;  // 千円（FY26期初予算）
  fy25OperatingProfit: number;  // 千円（FY25着地見込み）
  fy26Revenue: number;          // 売上高計（千円・FY26期初予算）
  profitStatus: "profit" | "loss" | "na";
  trend: "up" | "down" | "flat" | "na"; // FY25着地見込→FY26予算
  keyNote: string;              // 一行コメント
}

export const departmentFinancials: DeptFinancial[] = [
  { deptId: "all", budgetDeptName: "全社", fy26OperatingProfit: 514230, fy25OperatingProfit: 441920, fy26Revenue: 7165836, profitStatus: "profit", trend: "up", keyNote: "営業増益+72M（ケーブル船スキーム変更除く実質改善）" },
  { deptId: "planning", budgetDeptName: "総合企画部", fy26OperatingProfit: 0, fy25OperatingProfit: 0, fy26Revenue: 0, profitStatus: "na", trend: "na", keyNote: "間接部門（個別P/Lなし）" },
  { deptId: "hr", budgetDeptName: "人事総務部", fy26OperatingProfit: 0, fy25OperatingProfit: 0, fy26Revenue: 0, profitStatus: "na", trend: "na", keyNote: "間接部門（個別P/Lなし）" },
  { deptId: "finance", budgetDeptName: "経理部", fy26OperatingProfit: 0, fy25OperatingProfit: 0, fy26Revenue: 0, profitStatus: "na", trend: "na", keyNote: "間接部門（個別P/Lなし）" },
  { deptId: "maritime-tech", budgetDeptName: "海技事業部", fy26OperatingProfit: -40667, fy25OperatingProfit: 13539, fy26Revenue: 454234, profitStatus: "loss", trend: "down", keyNote: "赤字転落（大型コンサル案件不在）" },
  { deptId: "simulator", budgetDeptName: "シミュレータ技術部", fy26OperatingProfit: -63207, fy25OperatingProfit: 2313, fy26Revenue: 29050, profitStatus: "loss", trend: "down", keyNote: "検査減少で大幅赤字化" },
  { deptId: "training", budgetDeptName: "海技安全事業部", fy26OperatingProfit: 29827, fy25OperatingProfit: 31609, fy26Revenue: 285568, profitStatus: "profit", trend: "down", keyNote: "微減益（短期案件減少）" },
  { deptId: "cable", budgetDeptName: "ケーブル船事業部", fy26OperatingProfit: 58250, fy25OperatingProfit: 119541, fy26Revenue: 289105, profitStatus: "profit", trend: "down", keyNote: "スキーム変更で営業利益▲61M" },
  { deptId: "offshore-training", budgetDeptName: "オフショア船事業部", fy26OperatingProfit: 30327, fy25OperatingProfit: 41583, fy26Revenue: 235590, profitStatus: "profit", trend: "down", keyNote: "エネルギー補助金見込まず減益" },
  { deptId: "ocean", budgetDeptName: "海運事業部", fy26OperatingProfit: 130502, fy25OperatingProfit: 57058, fy26Revenue: 1188889, profitStatus: "profit", trend: "up", keyNote: "MOL受託料増加で大幅増益+73M" },
  { deptId: "wind", budgetDeptName: "洋上風力部", fy26OperatingProfit: -31689, fy25OperatingProfit: -12476, fy26Revenue: 22454, profitStatus: "loss", trend: "down", keyNote: "FY25末で部門廃止。FY26以降は各部署に機能分散、全般窓口は池田執行役員が継続" },
  { deptId: "onsite", budgetDeptName: "オンサイト事業部", fy26OperatingProfit: -46068, fy25OperatingProfit: -85187, fy26Revenue: 578296, profitStatus: "loss", trend: "up", keyNote: "赤字縮小（海技人材+5.8M、設備▲51.9M）" },
  { deptId: "maritime-ops", budgetDeptName: "海事事業部", fy26OperatingProfit: 177351, fy25OperatingProfit: 146279, fy26Revenue: 373057, profitStatus: "profit", trend: "up", keyNote: "販管費削減で増益+31M" },
  { deptId: "newbuild", budgetDeptName: "新造船PM事業本部", fy26OperatingProfit: 264758, fy25OperatingProfit: 122801, fy26Revenue: 3679269, profitStatus: "profit", trend: "up", keyNote: "全社最大増益+142M（PJ数21→23件）" },
];

export function getDeptFinancial(deptId: string): DeptFinancial | undefined {
  return departmentFinancials.find(d => d.deptId === deptId);
}

export function formatProfitLoss(amount: number): string {
  if (amount === 0) return "—";
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("ja-JP");
  return amount < 0 ? `▲${formatted}千円` : `+${formatted}千円`;
}

export function formatProfitLossShort(amount: number): string {
  if (amount === 0) return "—";
  const abs = Math.abs(amount);
  const millions = Math.round(abs / 1000);
  return amount < 0 ? `▲${millions}M` : `+${millions}M`;
}

export function getFinancialSummaryForPrompt(): string {
  let text = "### 部門別 営業損益サマリー（FY25着地見込み → FY26期初予算）\n\n";
  text += "※FY25は2026年2月時点の着地見込み（未確定）、FY26は期初予算（予測値）です。いずれも実績確定値ではありません。\n\n";
  text += "| 部門 | FY26予算(千円) | FY25見込(千円) | 増減 | 状態 | 備考 |\n";
  text += "|------|---------------|---------------|------|------|------|\n";
  for (const d of departmentFinancials) {
    const yoy = d.fy26OperatingProfit - d.fy25OperatingProfit;
    const yoyStr = d.profitStatus === "na" ? "—" : formatProfitLoss(yoy);
    const statusStr = d.profitStatus === "profit" ? "黒字見込" : d.profitStatus === "loss" ? "赤字見込" : "—";
    text += `| ${d.budgetDeptName} | ${formatProfitLoss(d.fy26OperatingProfit)} | ${formatProfitLoss(d.fy25OperatingProfit)} | ${yoyStr} | ${statusStr} | ${d.keyNote} |\n`;
  }
  text += "\n**FY26赤字予算部門**: 海技事業部、シミュレータ技術部、洋上風力部、オンサイト事業部\n";
  text += "**FY26増益予算部門**: 全社、海運事業部、海事事業部、新造船PM事業本部\n";
  text += "**FY26減益予算部門**: 海技安全事業部、ケーブル船事業部、オフショア船事業部\n\n";
  return text;
}
