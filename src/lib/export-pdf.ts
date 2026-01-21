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
