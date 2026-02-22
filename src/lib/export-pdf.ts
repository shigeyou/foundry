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

// エグゼクティブサマリーPDF（全部門の概要を凝縮した経営向けレポート）
export interface ExecutiveSummaryInput {
  companyName: string;
  batchDate: string;
  departments: {
    name: string;
    executiveSummary: string;
    topStrategies: { name: string; score: number }[];
    issueCount: number;
    solutionCount: number;
  }[];
}

export async function exportExecutiveSummaryPdf(data: ExecutiveSummaryInput): Promise<void> {
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

  const generatedAt = new Date().toLocaleString("ja-JP");
  const totalIssues = data.departments.reduce((sum, d) => sum + d.issueCount, 0);
  const totalSolutions = data.departments.reduce((sum, d) => sum + d.solutionCount, 0);
  const totalStrategies = data.departments.reduce((sum, d) => sum + d.topStrategies.length, 0);

  // 全社サマリー（allスコープ）を取得
  const allDept = data.departments.find(d => d.name === "全社");
  const allSummary = allDept?.executiveSummary || "";

  // 全部門の戦略をスコアでソートしてトップ10を抽出
  const allStrategies = data.departments.flatMap(d =>
    d.topStrategies.map(s => ({ ...s, dept: d.name }))
  ).sort((a, b) => b.score - a.score).slice(0, 10);

  container.innerHTML = `
    <!-- ヘッダー -->
    <div style="border-bottom: 3px solid #4f46e5; padding-bottom: 16px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="font-size: 22px; font-weight: bold; margin: 0 0 4px 0; color: #1e293b;">
            📋 エグゼクティブサマリー
          </h1>
          <p style="font-size: 13px; color: #4f46e5; font-weight: bold; margin: 0;">
            ${escapeHtml(data.companyName)}
          </p>
        </div>
        <div style="text-align: right;">
          <p style="font-size: 10px; color: #64748b; margin: 0;">
            探索日: ${escapeHtml(data.batchDate)} ｜ 生成: ${escapeHtml(generatedAt)}
          </p>
        </div>
      </div>
    </div>

    <!-- KPIサマリー -->
    <div style="display: flex; gap: 12px; margin-bottom: 20px;">
      <div style="flex: 1; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 10px; text-align: center;">
        <div style="font-size: 22px; font-weight: bold; color: #7c3aed;">${data.departments.length}</div>
        <div style="font-size: 10px; color: #6b7280;">分析部門数</div>
      </div>
      <div style="flex: 1; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; text-align: center;">
        <div style="font-size: 22px; font-weight: bold; color: #dc2626;">${totalIssues}</div>
        <div style="font-size: 10px; color: #6b7280;">課題数</div>
      </div>
      <div style="flex: 1; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px; text-align: center;">
        <div style="font-size: 22px; font-weight: bold; color: #2563eb;">${totalSolutions}</div>
        <div style="font-size: 10px; color: #6b7280;">解決策数</div>
      </div>
      <div style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; text-align: center;">
        <div style="font-size: 22px; font-weight: bold; color: #059669;">${totalStrategies}</div>
        <div style="font-size: 10px; color: #6b7280;">勝ち筋数</div>
      </div>
    </div>

    <!-- 全社概要 -->
    ${allSummary ? `
    <div style="margin-bottom: 20px; padding: 14px; background: #f1f5f9; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="font-size: 13px; font-weight: bold; color: #4f46e5; margin: 0 0 6px 0;">全社概要</h3>
      <p style="font-size: 11px; color: #334155; margin: 0; line-height: 1.6;">${escapeHtml(allSummary)}</p>
    </div>
    ` : ""}

    <!-- トップ10勝ち筋 -->
    <div style="margin-bottom: 20px;">
      <h2 style="font-size: 14px; font-weight: bold; color: #1e293b; margin: 0 0 10px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">
        🏆 全社トップ10 勝ち筋
      </h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 6px 8px; text-align: left; border-bottom: 1px solid #e2e8f0; color: #64748b;">#</th>
            <th style="padding: 6px 8px; text-align: left; border-bottom: 1px solid #e2e8f0; color: #64748b;">勝ち筋</th>
            <th style="padding: 6px 8px; text-align: left; border-bottom: 1px solid #e2e8f0; color: #64748b;">部門</th>
            <th style="padding: 6px 8px; text-align: center; border-bottom: 1px solid #e2e8f0; color: #64748b;">スコア</th>
          </tr>
        </thead>
        <tbody>
          ${allStrategies.map((s, i) => `
            <tr style="${i % 2 === 0 ? "" : "background: #f8fafc;"}">
              <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; color: #94a3b8; font-weight: bold;">${i + 1}</td>
              <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: ${i < 3 ? "bold" : "normal"};">${escapeHtml(s.name)}</td>
              <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9;">
                <span style="background: #e0e7ff; color: #4338ca; padding: 1px 6px; border-radius: 4px; font-size: 10px;">${escapeHtml(s.dept)}</span>
              </td>
              <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; text-align: center; font-weight: bold; color: ${s.score >= 3.5 ? "#059669" : s.score >= 2.5 ? "#2563eb" : "#d97706"};">${s.score.toFixed(1)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <!-- 部門別ハイライト -->
    <div style="margin-bottom: 16px;">
      <h2 style="font-size: 14px; font-weight: bold; color: #1e293b; margin: 0 0 10px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">
        🏢 部門別ハイライト
      </h2>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        ${data.departments.filter(d => d.name !== "全社").map(dept => {
          const topStrat = dept.topStrategies[0];
          return `
          <div style="padding: 8px 10px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
              <span style="font-size: 11px; font-weight: bold; color: #1e293b;">${escapeHtml(dept.name)}</span>
              <span style="font-size: 9px; color: #94a3b8;">課題${dept.issueCount} 解決策${dept.solutionCount} 勝ち筋${dept.topStrategies.length}</span>
            </div>
            ${topStrat ? `
              <p style="font-size: 10px; color: #4f46e5; margin: 0; font-weight: 500;">
                ★ ${escapeHtml(topStrat.name)}（${topStrat.score.toFixed(1)}）
              </p>
            ` : ""}
          </div>
          `;
        }).join("")}
      </div>
    </div>

    <!-- フッター -->
    <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="font-size: 9px; color: #94a3b8; margin: 0;">
        勝ち筋ファインダー エグゼクティブサマリー | AI分析 | ${escapeHtml(generatedAt)}
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
    pdf.save(`${dateStr}_エグゼクティブサマリー.pdf`);
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
