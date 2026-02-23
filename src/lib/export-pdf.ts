import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

interface WinningStrategy {
  name: string;
  reason: string;
  howToObtain: string;
  metrics: string;
  confidence: "high" | "medium" | "low";
  tags: string[];
}

interface ExplorationResult {
  strategies: WinningStrategy[];
  thinkingProcess: string;
  followUpQuestions?: string[];
}

// Convert exploration result to Markdown format
export function resultToMarkdown(
  question: string,
  result: ExplorationResult
): string {
  const timestamp = new Date().toLocaleString("ja-JP");

  let md = `# 勝ち筋探索レポート\n\n`;
  md += `**生成日時:** ${timestamp}\n\n`;
  md += `## 問い\n\n${question}\n\n`;

  if (result.thinkingProcess) {
    md += `## 思考プロセス\n\n${result.thinkingProcess}\n\n`;
  }

  md += `## 勝ち筋一覧（${result.strategies?.length || 0}件）\n\n`;

  result.strategies?.forEach((strategy, index) => {
    const confidenceLabel = {
      high: "高",
      medium: "中",
      low: "低",
    }[strategy.confidence] || strategy.confidence;

    md += `### ${index + 1}. ${strategy.name}\n\n`;
    md += `**確度:** ${confidenceLabel}\n\n`;

    if (strategy.tags?.length > 0) {
      md += `**タグ:** ${strategy.tags.join(", ")}\n\n`;
    }

    md += `#### なぜ勝てる\n\n${strategy.reason}\n\n`;
    md += `#### 入手方法\n\n${strategy.howToObtain}\n\n`;
    md += `#### 指標例\n\n${strategy.metrics}\n\n`;
    md += `---\n\n`;
  });

  if (result.followUpQuestions?.length) {
    md += `## フォローアップ質問\n\n`;
    result.followUpQuestions.forEach((q, i) => {
      md += `${i + 1}. ${q}\n`;
    });
  }

  return md;
}

// Export result as PDF by capturing HTML element
export async function exportToPdf(
  elementId: string,
  filename: string = "kachisuji-report"
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error("Export element not found");
  }

  // Capture the element as canvas
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  const imgWidth = contentWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  // Add first page
  pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
  heightLeft -= pageHeight - margin * 2;

  // Add additional pages if content is longer than one page
  while (heightLeft > 0) {
    position = heightLeft - imgHeight + margin;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;
  }

  pdf.save(`${filename}.pdf`);
}

// Export Markdown as downloadable file
export function exportToMarkdown(
  question: string,
  result: ExplorationResult,
  filename: string = "kachisuji-report"
): void {
  const markdown = resultToMarkdown(question, result);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 1枚サマリーPDF出力（凝縮版）
interface SummaryData {
  title: string;
  situation: string;
  topStrategies: { name: string; reason: string }[];
  nextAction: string;
  generatedAt?: string;
}

export async function exportSummaryPdf(data: SummaryData): Promise<void> {
  // 一時的なHTML要素を作成して日本語を正しくレンダリング
  const container = document.createElement("div");
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: 794px;
    padding: 40px;
    background: white;
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif;
    color: #1a1a1a;
  `;

  const generatedAt = data.generatedAt || new Date().toLocaleString("ja-JP");

  container.innerHTML = `
    <div style="border-bottom: 3px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px;">
      <h1 style="font-size: 24px; font-weight: bold; margin: 0 0 8px 0; color: #1e293b;">
        ${escapeHtml(data.title || "戦略サマリー")}
      </h1>
      <p style="font-size: 12px; color: #64748b; margin: 0;">
        生成日時: ${escapeHtml(generatedAt)}
      </p>
    </div>

    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 16px; font-weight: bold; color: #4f46e5; margin: 0 0 12px 0;">
        📊 状況認識
      </h2>
      <p style="font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">
        ${escapeHtml(data.situation)}
      </p>
    </div>

    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 16px; font-weight: bold; color: #4f46e5; margin: 0 0 12px 0;">
        🎯 主要な勝ち筋
      </h2>
      <ul style="margin: 0; padding-left: 0; list-style: none;">
        ${data.topStrategies.map((s, i) => `
          <li style="margin-bottom: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #4f46e5;">
            <strong style="font-size: 14px; display: block; margin-bottom: 4px;">
              ${i + 1}. ${escapeHtml(s.name)}
            </strong>
            <span style="font-size: 13px; color: #475569;">
              ${escapeHtml(s.reason)}
            </span>
          </li>
        `).join("")}
      </ul>
    </div>

    <div style="background: #fef3c7; padding: 16px; border-radius: 8px;">
      <h2 style="font-size: 16px; font-weight: bold; color: #92400e; margin: 0 0 8px 0;">
        ⚡ 次のアクション
      </h2>
      <p style="font-size: 14px; margin: 0; color: #78350f;">
        ${escapeHtml(data.nextAction)}
      </p>
    </div>

    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="font-size: 11px; color: #94a3b8; margin: 0;">
        勝ち筋ファインダー | AI分析
      </p>
    </div>
  `;

  document.body.appendChild(container);

  try {
    // html2canvasで日本語を含む要素をキャプチャ
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;

    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    // 最初のページ
    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;

    // 追加ページ（コンテンツが長い場合）
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    // ファイル名: yyyymmdd_勝ち筋探索まとめ.pdf
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    pdf.save(`${dateStr}_勝ち筋探索まとめ.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

// メタファインダー結果レポートPDF出力
interface MetaFinderBatchSummary {
  batch: {
    id: string;
    status: string;
    totalPatterns: number;
    completedPatterns: number;
    totalIdeas: number;
    startedAt: string;
    completedAt?: string;
  };
  stats: {
    totalIdeas: number;
    avgScore: string;
    avgFinancial: string;
    avgCustomer: string;
    avgProcess: string;
    avgGrowth: string;
    maxScore: number;
  };
  scoreDistribution: {
    excellent: number;
    good: number;
    average: number;
    low: number;
  };
  topIdeas: MetaFinderIdeaItem[];
  themeBest: MetaFinderIdeaItem[];
  deptBest: MetaFinderIdeaItem[];
}

interface MetaFinderIdeaItem {
  id: string;
  themeId: string;
  themeName: string;
  deptId: string;
  deptName: string;
  name: string;
  description: string;
  reason: string;
  financial: number;
  customer: number;
  process: number;
  growth: number;
  score: number;
}

export async function exportMetaFinderPdf(data: MetaFinderBatchSummary): Promise<void> {
  const container = document.createElement("div");
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: 794px;
    padding: 40px;
    background: white;
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif;
    color: #1a1a1a;
    line-height: 1.5;
  `;

  const startedAt = new Date(data.batch.startedAt).toLocaleString("ja-JP");
  const completedAt = data.batch.completedAt
    ? new Date(data.batch.completedAt).toLocaleString("ja-JP")
    : "―";
  const generatedAt = new Date().toLocaleString("ja-JP");

  const scoreColor = (score: number) => {
    if (score >= 4) return "#059669";
    if (score >= 3) return "#2563eb";
    if (score >= 2) return "#d97706";
    return "#dc2626";
  };

  const renderIdea = (idea: MetaFinderIdeaItem, index: number) => `
    <div style="margin-bottom: 10px; padding: 10px; background: #f8fafc; border-radius: 6px; border-left: 4px solid ${scoreColor(idea.score)}; page-break-inside: avoid;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
        <strong style="font-size: 13px; color: #1e293b;">${index + 1}. ${escapeHtml(idea.name)}</strong>
        <span style="font-size: 13px; font-weight: bold; color: ${scoreColor(idea.score)}; white-space: nowrap; margin-left: 8px;">${idea.score.toFixed(1)}</span>
      </div>
      <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">
        <span style="background: #ede9fe; color: #6d28d9; padding: 1px 6px; border-radius: 4px; margin-right: 4px;">${escapeHtml(idea.themeName)}</span>
        <span style="background: #e0e7ff; color: #4338ca; padding: 1px 6px; border-radius: 4px;">${escapeHtml(idea.deptName)}</span>
      </div>
      <p style="font-size: 11px; color: #334155; margin: 4px 0 2px 0;">${escapeHtml(idea.description)}</p>
      <p style="font-size: 10px; color: #64748b; margin: 2px 0;">理由: ${escapeHtml(idea.reason)}</p>
      <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
        💰${idea.financial}/5 &nbsp; 👥${idea.customer}/5 &nbsp; ⚙️${idea.process}/5 &nbsp; 🌱${idea.growth}/5
      </div>
    </div>
  `;

  container.innerHTML = `
    <!-- ヘッダー -->
    <div style="border-bottom: 3px solid #7c3aed; padding-bottom: 16px; margin-bottom: 20px;">
      <h1 style="font-size: 22px; font-weight: bold; margin: 0 0 8px 0; color: #1e293b;">
        🌱 勝ち筋ファインダー 結果レポート
      </h1>
      <p style="font-size: 11px; color: #64748b; margin: 0;">
        レポート生成: ${escapeHtml(generatedAt)} ｜ 探索期間: ${escapeHtml(startedAt)} → ${escapeHtml(completedAt)}
      </p>
    </div>

    <!-- 統計サマリー -->
    <div style="display: flex; gap: 12px; margin-bottom: 20px;">
      <div style="flex: 1; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #7c3aed;">${data.stats.totalIdeas}</div>
        <div style="font-size: 11px; color: #6b7280;">総アイデア数</div>
      </div>
      <div style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #059669;">${data.stats.avgScore}</div>
        <div style="font-size: 11px; color: #6b7280;">平均スコア</div>
      </div>
      <div style="flex: 1; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #2563eb;">${data.scoreDistribution.excellent}</div>
        <div style="font-size: 11px; color: #6b7280;">高スコア (4+)</div>
      </div>
      <div style="flex: 1; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 12px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #4f46e5;">${data.stats.maxScore?.toFixed(1) || "―"}</div>
        <div style="font-size: 11px; color: #6b7280;">最高スコア</div>
      </div>
    </div>

    <!-- BSC 4視点平均 -->
    <div style="display: flex; gap: 12px; margin-bottom: 24px;">
      <div style="flex: 1; background: #f0fdf4; border-radius: 6px; padding: 8px; text-align: center; border: 1px solid #d1fae5;">
        <div style="font-size: 16px; font-weight: bold; color: #059669;">💰 ${data.stats.avgFinancial}</div>
        <div style="font-size: 10px; color: #6b7280;">財務視点</div>
      </div>
      <div style="flex: 1; background: #eff6ff; border-radius: 6px; padding: 8px; text-align: center; border: 1px solid #bfdbfe;">
        <div style="font-size: 16px; font-weight: bold; color: #2563eb;">👥 ${data.stats.avgCustomer}</div>
        <div style="font-size: 10px; color: #6b7280;">顧客視点</div>
      </div>
      <div style="flex: 1; background: #faf5ff; border-radius: 6px; padding: 8px; text-align: center; border: 1px solid #e9d5ff;">
        <div style="font-size: 16px; font-weight: bold; color: #7c3aed;">⚙️ ${data.stats.avgProcess}</div>
        <div style="font-size: 10px; color: #6b7280;">業務プロセス視点</div>
      </div>
      <div style="flex: 1; background: #fff7ed; border-radius: 6px; padding: 8px; text-align: center; border: 1px solid #fed7aa;">
        <div style="font-size: 16px; font-weight: bold; color: #ea580c;">🌱 ${data.stats.avgGrowth}</div>
        <div style="font-size: 10px; color: #6b7280;">学習と成長視点</div>
      </div>
    </div>

    <!-- スコア分布 -->
    <div style="margin-bottom: 24px; padding: 12px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
      <h3 style="font-size: 13px; font-weight: bold; color: #374151; margin: 0 0 8px 0;">スコア分布</h3>
      <div style="display: flex; gap: 16px; font-size: 12px;">
        <span style="color: #059669;">■ 優秀 (4+): ${data.scoreDistribution.excellent}件</span>
        <span style="color: #2563eb;">■ 良好 (3-4): ${data.scoreDistribution.good}件</span>
        <span style="color: #d97706;">■ 普通 (2-3): ${data.scoreDistribution.average}件</span>
        <span style="color: #dc2626;">■ 低 (2未満): ${data.scoreDistribution.low}件</span>
      </div>
    </div>

    <!-- 全体トップ20 -->
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 16px; font-weight: bold; color: #7c3aed; margin: 0 0 12px 0; border-bottom: 2px solid #e9d5ff; padding-bottom: 6px;">
        🏆 全体トップ20
      </h2>
      ${data.topIdeas.map((idea, i) => renderIdea(idea, i)).join("")}
    </div>

    <!-- テーマ別ベスト -->
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 16px; font-weight: bold; color: #2563eb; margin: 0 0 12px 0; border-bottom: 2px solid #bfdbfe; padding-bottom: 6px;">
        📊 テーマ別ベスト
      </h2>
      ${data.themeBest.map((idea, i) => renderIdea(idea, i)).join("")}
    </div>

    <!-- 部門別ベスト -->
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 16px; font-weight: bold; color: #059669; margin: 0 0 12px 0; border-bottom: 2px solid #bbf7d0; padding-bottom: 6px;">
        🏢 部門別ベスト
      </h2>
      ${data.deptBest.map((idea, i) => renderIdea(idea, i)).join("")}
    </div>

    <!-- フッター -->
    <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="font-size: 10px; color: #94a3b8; margin: 0;">
        勝ち筋ファインダー | AI分析 | ${escapeHtml(generatedAt)}
      </p>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    // 1ページあたりのキャンバス上のピクセル高さ
    const pxPerMm = canvas.width / contentWidth;
    const pageHeightPx = Math.floor(usableHeight * pxPerMm);

    let srcY = 0;
    let pageIndex = 0;

    while (srcY < canvas.height) {
      if (pageIndex > 0) pdf.addPage();

      const sliceHeight = Math.min(pageHeightPx, canvas.height - srcY);

      // キャンバスからページ分だけ切り出す
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const ctx = pageCanvas.getContext("2d")!;
      ctx.drawImage(
        canvas,
        0, srcY, canvas.width, sliceHeight,
        0, 0, canvas.width, sliceHeight
      );

      const pageImgData = pageCanvas.toDataURL("image/png");
      const sliceHeightMm = sliceHeight / pxPerMm;

      pdf.addImage(pageImgData, "PNG", margin, margin, contentWidth, sliceHeightMm);

      srcY += pageHeightPx;
      pageIndex++;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    pdf.save(`${dateStr}_勝ち筋ファインダー結果レポート.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

// lab()/oklch()等の未対応カラーをhtml2canvas用にフォールバックする
function sanitizeColorsForCanvas(root: HTMLElement): (() => void) {
  const originals: { el: HTMLElement; prop: string; value: string }[] = [];
  const labRegex = /lab\(|oklch\(|oklab\(|lch\(/i;

  const walk = (el: HTMLElement) => {
    const computed = getComputedStyle(el);
    const propsToCheck = [
      "background", "background-image", "background-color",
      "color", "border-color", "box-shadow",
    ];
    for (const prop of propsToCheck) {
      const val = computed.getPropertyValue(prop);
      if (val && labRegex.test(val)) {
        originals.push({ el, prop, value: el.style.getPropertyValue(prop) });
        // lab/oklchをrgbにfallback: 透明にするか白にする
        if (prop.includes("background")) {
          el.style.setProperty(prop, "transparent", "important");
        } else if (prop === "color") {
          el.style.setProperty(prop, "#1a1a1a", "important");
        } else {
          el.style.setProperty(prop, "transparent", "important");
        }
      }
    }
    for (const child of el.children) {
      if (child instanceof HTMLElement) walk(child);
    }
  };
  walk(root);

  return () => {
    for (const { el, prop, value } of originals) {
      if (value) {
        el.style.setProperty(prop, value);
      } else {
        el.style.removeProperty(prop);
      }
    }
  };
}

// メタファインダー レポートPDF出力（HTML要素をキャプチャ）
export async function exportReportPdf(elementId: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Export element not found");

  // PDF用にスタイルを一時的に調整
  const originalBg = element.style.background;
  element.style.background = "white";

  // dark mode対応：一時的にlightにする
  const htmlEl = document.documentElement;
  const wasDark = htmlEl.classList.contains("dark");
  if (wasDark) htmlEl.classList.remove("dark");

  // html2canvas未対応のカラー関数をフォールバック
  const restoreColors = sanitizeColorsForCanvas(element);

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: element.scrollWidth,
      windowWidth: element.scrollWidth,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    const pxPerMm = canvas.width / contentWidth;
    const pageHeightPx = Math.floor(usableHeight * pxPerMm);

    let srcY = 0;
    let pageIndex = 0;

    while (srcY < canvas.height) {
      if (pageIndex > 0) pdf.addPage();

      const sliceHeight = Math.min(pageHeightPx, canvas.height - srcY);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const ctx = pageCanvas.getContext("2d")!;
      ctx.drawImage(canvas, 0, srcY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

      const pageImgData = pageCanvas.toDataURL("image/png");
      const sliceHeightMm = sliceHeight / pxPerMm;
      pdf.addImage(pageImgData, "PNG", margin, margin, contentWidth, sliceHeightMm);

      srcY += pageHeightPx;
      pageIndex++;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    pdf.save(`${dateStr}_勝ち筋ファインダー報告書.pdf`);
  } finally {
    restoreColors();
    element.style.background = originalBg;
    if (wasDark) htmlEl.classList.add("dark");
  }
}

// エグゼクティブサマリーPDF（全部門を1枚の表形式でまとめた経営向けレポート）
export interface ExecutiveSummaryInput {
  companyName: string;
  batchDate: string;
  departments: {
    name: string;
    issues: { title: string; severity: "high" | "medium" | "low" }[];
    solutions: { title: string; priority: string }[];
    strategies: { name: string; score: number }[];
  }[];
}

export async function exportExecutiveSummaryPdf(data: ExecutiveSummaryInput): Promise<void> {
  const container = document.createElement("div");
  // 縦向きA4: 210mm × 3.78px/mm ≈ 794px
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: 794px;
    padding: 18px 20px 14px;
    background: white;
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif;
    color: #1a1a1a;
    line-height: 1.4;
    box-sizing: border-box;
  `;

  const generatedAt = new Date().toLocaleString("ja-JP");

  const sevBadge = (sev: "high" | "medium" | "low") => {
    const map = {
      high: ["#fef2f2", "#dc2626", "高"],
      medium: ["#fffbeb", "#d97706", "中"],
      low: ["#f0fdf4", "#059669", "低"],
    };
    const [bg, color, label] = map[sev] || map.medium;
    return `<span style="display:inline-block;background:${bg};color:${color};font-size:9px;font-weight:bold;padding:1px 5px;border-radius:3px;border:1px solid ${color};white-space:nowrap;">${label}</span>`;
  };

  const priLabel = (p: string) => {
    if (p === "immediate") return ["#fef2f2", "#dc2626", "即時"];
    if (p === "short-term") return ["#eff6ff", "#2563eb", "短期"];
    return ["#faf5ff", "#7c3aed", "中期"];
  };

  const scoreColor = (s: number) => s >= 4 ? "#059669" : s >= 3 ? "#2563eb" : "#d97706";

  const renderIssues = (items: { title: string; severity: "high" | "medium" | "low" }[]) => {
    const sorted = [...items].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.severity] ?? 1) - (order[b.severity] ?? 1);
    });
    const shown = sorted.slice(0, 3);
    const rest = sorted.length - shown.length;
    return shown.map(i => `
      <div style="display:flex;align-items:flex-start;gap:3px;margin-bottom:3px;">
        ${sevBadge(i.severity)}
        <span style="font-size:9px;color:#1e293b;line-height:1.3;">${escapeHtml(i.title)}</span>
      </div>
    `).join("") + (rest > 0 ? `<div style="font-size:8px;color:#94a3b8;margin-top:1px;">他 ${rest}件</div>` : "");
  };

  const renderSolutions = (items: { title: string; priority: string }[]) => {
    const sorted = [...items].sort((a, b) => {
      const order: Record<string, number> = { immediate: 0, "short-term": 1, "mid-term": 2 };
      return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
    });
    const shown = sorted.slice(0, 3);
    const rest = sorted.length - shown.length;
    return shown.map(s => {
      const [bg, color, label] = priLabel(s.priority);
      return `
        <div style="display:flex;align-items:flex-start;gap:3px;margin-bottom:3px;">
          <span style="display:inline-block;background:${bg};color:${color};font-size:8px;font-weight:bold;padding:1px 4px;border-radius:3px;border:1px solid ${color};white-space:nowrap;">${label}</span>
          <span style="font-size:9px;color:#1e293b;line-height:1.3;">${escapeHtml(s.title)}</span>
        </div>
      `;
    }).join("") + (rest > 0 ? `<div style="font-size:8px;color:#94a3b8;margin-top:1px;">他 ${rest}件</div>` : "");
  };

  const renderStrategies = (items: { name: string; score: number }[]) => {
    const sorted = [...items].sort((a, b) => b.score - a.score);
    const shown = sorted.slice(0, 3);
    const rest = sorted.length - shown.length;
    return shown.map(s => {
      const c = scoreColor(s.score);
      return `
        <div style="display:flex;align-items:flex-start;gap:3px;margin-bottom:3px;">
          <span style="display:inline-block;background:white;color:${c};font-size:8px;font-weight:bold;padding:1px 4px;border-radius:3px;border:1px solid ${c};white-space:nowrap;">${s.score.toFixed(1)}</span>
          <span style="font-size:9px;color:#1e293b;line-height:1.3;">${escapeHtml(s.name)}</span>
        </div>
      `;
    }).join("") + (rest > 0 ? `<div style="font-size:8px;color:#94a3b8;margin-top:1px;">他 ${rest}件</div>` : "");
  };

  const rowBg = (i: number) => i % 2 === 0 ? "#ffffff" : "#f8fafc";
  const cellStyle = `padding:6px 8px;border:1px solid #e2e8f0;vertical-align:top;`;
  const deptCellStyle = `${cellStyle}background:#eef2ff;font-weight:bold;font-size:10px;color:#3730a3;text-align:center;vertical-align:middle;`;

  container.innerHTML = `
    <!-- ヘッダー -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #4f46e5;padding-bottom:8px;margin-bottom:10px;">
      <div>
        <h1 style="font-size:15px;font-weight:bold;margin:0 0 2px;color:#1e293b;">📋 エグゼクティブサマリー</h1>
        <p style="font-size:11px;color:#4f46e5;font-weight:bold;margin:0;">${escapeHtml(data.companyName)}</p>
      </div>
      <p style="font-size:8px;color:#64748b;margin:0;">探索日: ${escapeHtml(data.batchDate)} ｜ 生成: ${escapeHtml(generatedAt)}</p>
    </div>

    <!-- 表 -->
    <table style="width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed;">
      <colgroup>
        <col style="width:82px;">
        <col style="width:222px;">
        <col style="width:224px;">
        <col style="width:226px;">
      </colgroup>
      <thead>
        <tr>
          <th style="${cellStyle}background:#1e293b;color:white;font-size:10px;text-align:center;">部門</th>
          <th style="${cellStyle}background:#dc2626;color:white;font-size:10px;text-align:center;">① 課題</th>
          <th style="${cellStyle}background:#2563eb;color:white;font-size:10px;text-align:center;">② 解決策</th>
          <th style="${cellStyle}background:#059669;color:white;font-size:10px;text-align:center;">③ 勝ち筋</th>
        </tr>
      </thead>
      <tbody>
        ${data.departments.map((dept, i) => `
          <tr style="background:${rowBg(i)};">
            <td style="${deptCellStyle}">${escapeHtml(dept.name)}</td>
            <td style="${cellStyle}background:${rowBg(i)};">${renderIssues(dept.issues)}</td>
            <td style="${cellStyle}background:${rowBg(i)};">${renderSolutions(dept.solutions)}</td>
            <td style="${cellStyle}background:${rowBg(i)};">${renderStrategies(dept.strategies)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <!-- フッター -->
    <div style="margin-top:6px;text-align:center;">
      <p style="font-size:7px;color:#94a3b8;margin:0;">勝ち筋ファインダー エグゼクティブサマリー | AI分析 | ${escapeHtml(generatedAt)}</p>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: 794,
      windowWidth: 794,
    });

    // 縦向きA4でPDF生成
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();   // 210mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
    const margin = 0;
    const contentWidth = pageWidth - margin * 2;
    const pxPerMm = canvas.width / contentWidth;
    const pageHeightPx = Math.floor((pageHeight - margin * 2) * pxPerMm);

    let srcY = 0;
    let pageIndex = 0;
    while (srcY < canvas.height) {
      if (pageIndex > 0) pdf.addPage();
      const sliceHeight = Math.min(pageHeightPx, canvas.height - srcY);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      pageCanvas.getContext("2d")!.drawImage(canvas, 0, srcY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", margin, margin, contentWidth, sliceHeight / pxPerMm);
      srcY += pageHeightPx;
      pageIndex++;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    pdf.save(`${dateStr}_エグゼクティブサマリー.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

// 全部門レポートPDF（全スコープ分を1ファイルに出力）
interface FullReportRecord {
  scope: string;
  scopeName: string;
  sections: string; // JSON
  status: string;
}

export async function exportFullReportPdfFromData(
  records: FullReportRecord[],
  batchInfo?: { totalIdeas: number; startedAt: string }
): Promise<void> {
  const container = document.createElement("div");
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: 794px;
    padding: 40px;
    background: white;
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif;
    color: #1a1a1a;
    line-height: 1.6;
  `;

  const generatedAt = new Date().toLocaleString("ja-JP");
  const completedRecords = records.filter(r => r.status === "completed");

  const sevColor = (sev: string) => {
    if (sev === "high") return { bg: "#fef2f2", text: "#dc2626", border: "#dc2626" };
    if (sev === "medium") return { bg: "#fffbeb", text: "#d97706", border: "#d97706" };
    return { bg: "#f0fdf4", text: "#059669", border: "#059669" };
  };
  const priLabel = (p: string) => p === "immediate" ? "即時対応" : p === "short-term" ? "短期" : "中期";
  const priColor = (p: string) => p === "immediate" ? "#dc2626" : p === "short-term" ? "#2563eb" : "#7c3aed";

  const deptHtmlParts = completedRecords.map((record, idx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sections: any;
    try { sections = JSON.parse(record.sections); } catch { return ""; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const issues: any[] = sections.issues?.items || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const solutions: any[] = sections.solutions?.items || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const strategies: any[] = sections.strategies?.items || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const issuesHtml = issues.map((issue: any, i: number) => {
      const c = sevColor(issue.severity || "medium");
      const sevLabel = issue.severity === "high" ? "重要度高" : issue.severity === "medium" ? "重要度中" : "重要度低";
      return `<div style="margin-bottom:8px;padding:9px;background:${c.bg};border-left:4px solid ${c.border};border-radius:4px;">
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;">
          <span style="font-size:10px;font-weight:bold;color:${c.text};background:white;padding:1px 6px;border-radius:4px;border:1px solid ${c.border};">${sevLabel}</span>
          <span style="font-size:10px;color:#64748b;background:#f1f5f9;padding:1px 6px;border-radius:4px;">${escapeHtml(issue.category || "")}</span>
        </div>
        ${issue.title ? `<p style="font-size:12px;font-weight:bold;color:#1e293b;margin:0 0 3px 0;">${i + 1}. ${escapeHtml(issue.title)}</p>` : ""}
        <p style="font-size:11px;color:#334155;margin:0 0 2px 0;">${escapeHtml(issue.challenge || "")}</p>
        ${issue.evidence ? `<p style="font-size:10px;color:#64748b;margin:0;"><b>根拠:</b> ${escapeHtml(issue.evidence)}</p>` : ""}
      </div>`;
    }).join("");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const solutionsHtml = solutions.map((sol: any, i: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actions = (sol.actions || []).map((a: any) => `<li style="margin-bottom:1px;">${escapeHtml(String(a))}</li>`).join("");
      return `<div style="margin-bottom:8px;padding:9px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
          <span style="font-size:12px;font-weight:bold;color:#1e293b;">${i + 1}. ${escapeHtml(sol.title || sol.solution || "")}</span>
          <span style="font-size:10px;font-weight:bold;color:${priColor(sol.priority)};white-space:nowrap;margin-left:8px;">${priLabel(sol.priority)}</span>
        </div>
        ${sol.title && sol.solution ? `<p style="font-size:10px;color:#64748b;margin:0 0 2px 0;">${escapeHtml(sol.solution)}</p>` : ""}
        <p style="font-size:10px;color:#64748b;margin:0 0 2px 0;">対応課題: ${escapeHtml(sol.challenge || "")}</p>
        <p style="font-size:11px;color:#334155;margin:0 0 3px 0;">${escapeHtml(sol.description || "")}</p>
        ${actions ? `<ul style="margin:3px 0 3px 16px;padding:0;font-size:10px;color:#475569;">${actions}</ul>` : ""}
        ${sol.expectedOutcome ? `<p style="font-size:10px;color:#059669;margin:0;"><i>期待成果: ${escapeHtml(sol.expectedOutcome)}</i></p>` : ""}
      </div>`;
    }).join("");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const strategiesHtml = strategies.map((strat: any, i: number) => {
      const bsc = strat.bscScores;
      const avg = bsc ? ((bsc.financial + bsc.customer + bsc.process + bsc.growth) / 4).toFixed(1) : "?";
      const sc = parseFloat(avg) >= 4 ? "#059669" : parseFloat(avg) >= 3 ? "#2563eb" : "#d97706";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const acts = (strat.keyActions || []).map((a: any) => `<li>${escapeHtml(String(a))}</li>`).join("");
      return `<div style="margin-bottom:8px;padding:9px;background:#faf5ff;border-radius:6px;border:1px solid #e9d5ff;">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
          <span style="font-size:12px;font-weight:bold;color:#1e293b;">${i + 1}. ${escapeHtml(strat.name || "")}</span>
          <span style="font-size:14px;font-weight:bold;color:${sc};">${avg}</span>
        </div>
        <p style="font-size:11px;color:#334155;margin:0 0 3px 0;">${escapeHtml(strat.description || "")}</p>
        ${bsc ? `<div style="font-size:10px;color:#64748b;margin-bottom:3px;">💰財務${bsc.financial} 👥顧客${bsc.customer} ⚙️業務${bsc.process} 🌱成長${bsc.growth}</div>` : ""}
        ${acts ? `<ul style="margin:0 0 3px 16px;padding:0;font-size:10px;color:#475569;">${acts}</ul>` : ""}
        ${strat.kpi ? `<p style="font-size:10px;color:#4f46e5;margin:0;"><b>KPI:</b> ${escapeHtml(strat.kpi)}</p>` : ""}
      </div>`;
    }).join("");

    return `
      ${idx > 0 ? `<div style="margin-top:40px;border-top:3px solid #e2e8f0;padding-top:24px;"></div>` : ""}
      <div style="border-bottom:2px solid #4f46e5;padding-bottom:10px;margin-bottom:14px;">
        <h2 style="font-size:20px;font-weight:bold;margin:0;color:#1e293b;">${escapeHtml(record.scopeName)}</h2>
      </div>
      <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:12px;margin-bottom:14px;">
        <h3 style="font-size:12px;font-weight:bold;color:#4338ca;margin:0 0 6px 0;">📋 エグゼクティブサマリー</h3>
        <p style="font-size:12px;color:#1e293b;margin:0;line-height:1.6;">${escapeHtml(sections.executiveSummary || "")}</p>
      </div>
      <div style="margin-bottom:14px;">
        <h3 style="font-size:13px;font-weight:bold;color:#dc2626;margin:0 0 8px 0;border-bottom:2px solid #fecaca;padding-bottom:4px;">1. 課題整理（${issues.length}件）</h3>
        ${sections.issues?.summary ? `<p style="font-size:10px;color:#64748b;margin:0 0 8px 0;border-left:3px solid #e2e8f0;padding-left:8px;">${escapeHtml(sections.issues.summary)}</p>` : ""}
        ${issuesHtml}
      </div>
      <div style="margin-bottom:14px;">
        <h3 style="font-size:13px;font-weight:bold;color:#2563eb;margin:0 0 8px 0;border-bottom:2px solid #bfdbfe;padding-bottom:4px;">2. 解決策策定（${solutions.length}件）</h3>
        ${sections.solutions?.summary ? `<p style="font-size:10px;color:#64748b;margin:0 0 8px 0;border-left:3px solid #e2e8f0;padding-left:8px;">${escapeHtml(sections.solutions.summary)}</p>` : ""}
        ${solutionsHtml}
      </div>
      <div style="margin-bottom:20px;">
        <h3 style="font-size:13px;font-weight:bold;color:#7c3aed;margin:0 0 8px 0;border-bottom:2px solid #e9d5ff;padding-bottom:4px;">3. 勝ち筋提案（${strategies.length}件）</h3>
        ${sections.strategies?.summary ? `<p style="font-size:10px;color:#64748b;margin:0 0 8px 0;border-left:3px solid #e2e8f0;padding-left:8px;">${escapeHtml(sections.strategies.summary)}</p>` : ""}
        ${strategiesHtml}
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div style="text-align:center;padding:60px 0 40px;border-bottom:3px solid #4f46e5;margin-bottom:32px;">
      <h1 style="font-size:26px;font-weight:bold;color:#1e293b;margin:0 0 10px;">勝ち筋ファインダー レポート</h1>
      <p style="font-size:14px;color:#4f46e5;margin:0 0 6px;">部門別 課題・解決策・勝ち筋</p>
      ${batchInfo ? `<p style="font-size:12px;color:#64748b;margin:0 0 4px;">探索日: ${new Date(batchInfo.startedAt).toLocaleDateString("ja-JP")} | ${batchInfo.totalIdeas}件のアイデア</p>` : ""}
      <p style="font-size:11px;color:#94a3b8;margin:0;">生成: ${generatedAt} | ${completedRecords.length}部門</p>
    </div>
    ${deptHtmlParts}
    <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="font-size:9px;color:#94a3b8;margin:0;">勝ち筋ファインダー | AI分析 | ${escapeHtml(generatedAt)}</p>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: 794,
      windowWidth: 794,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    const pxPerMm = canvas.width / contentWidth;
    const pageHeightPx = Math.floor((pageHeight - margin * 2) * pxPerMm);

    let srcY = 0;
    let pageIndex = 0;
    while (srcY < canvas.height) {
      if (pageIndex > 0) pdf.addPage();
      const sliceHeight = Math.min(pageHeightPx, canvas.height - srcY);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      pageCanvas.getContext("2d")!.drawImage(canvas, 0, srcY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", margin, margin, contentWidth, sliceHeight / pxPerMm);
      srcY += pageHeightPx;
      pageIndex++;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    pdf.save(`${dateStr}_勝ち筋ファインダー報告書_全部門.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

// HTMLエスケープ用ヘルパー
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
