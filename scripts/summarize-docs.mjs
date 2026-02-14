import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pdfParse from "pdf-parse";
import JSZip from "jszip";
import { AzureOpenAI } from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .envファイルを手動で読み込む
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        const value = valueParts.join("=").replace(/^["']|["']$/g, "");
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

const docsDir = path.join(__dirname, "..", "docs");
const summariesDir = path.join(docsDir, "summaries");

// Azure OpenAI client
function getClient() {
  return new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: "2024-08-01-preview",
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
  });
}

// PPTXからテキストを抽出
async function extractTextFromPptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const texts = [];

  const slideFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml")
  );

  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
    const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
    return numA - numB;
  });

  for (const slidePath of slideFiles) {
    const content = await zip.files[slidePath].async("string");
    const textMatches = content.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
    if (textMatches) {
      const slideTexts = textMatches
        .map((match) => match.replace(/<[^>]+>/g, ""))
        .filter((text) => text.trim());
      if (slideTexts.length > 0) {
        const slideNum = slidePath.match(/slide(\d+)/)?.[1];
        texts.push(`[スライド${slideNum}]\n${slideTexts.join("\n")}`);
      }
    }
  }

  return texts.join("\n\n");
}

// PDFからテキストを抽出
async function extractTextFromPdf(buffer) {
  const pdfData = await pdfParse(buffer);
  return pdfData.text;
}

// Azure OpenAIで要約を生成
async function summarizeText(filename, text) {
  const prompt = `以下のドキュメント「${filename}」の内容を要約してください。

## 要約形式
1. **ドキュメントの目的・概要**（1-2文）
2. **主要なポイント**（箇条書き5-10項目）
3. **具体的な数字・事実**（あれば箇条書き）
4. **キーワード**（カンマ区切り）
5. **この会社の課題・ニーズ**（推測できるもの）

## ドキュメント内容
${text.slice(0, 50000)}

## 要約（Markdown形式で）`;

  const response = await getClient().chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_completion_tokens: 4000,
  });

  return response.choices[0]?.message?.content || "";
}

async function processDocument(filePath) {
  const filename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // 既に要約があればスキップ
  const summaryFilename = filename.replace(/\.(pdf|pptx)$/i, "_summary.md");
  const summaryPath = path.join(summariesDir, summaryFilename);
  if (fs.existsSync(summaryPath)) {
    console.log(`  Skipping (already exists): ${summaryFilename}`);
    return false;
  }

  const buffer = fs.readFileSync(filePath);

  console.log(`\nProcessing: ${filename}`);

  let text = "";
  if (ext === ".pdf") {
    text = await extractTextFromPdf(buffer);
  } else if (ext === ".pptx") {
    text = await extractTextFromPptx(buffer);
  } else {
    console.log(`  Skipping unsupported file type: ${ext}`);
    return false;
  }

  console.log(`  Extracted ${text.length.toLocaleString()} characters`);

  if (text.length < 100) {
    console.log(`  Skipping (too short)`);
    return false;
  }

  // 要約を生成
  console.log(`  Generating summary with Azure OpenAI...`);
  const summary = await summarizeText(filename, text);

  // 保存
  const content = `# ${filename}

${summary}

---
*抽出元: ${filename}*
*テキスト長: ${text.length.toLocaleString()}文字*
*生成日時: ${new Date().toISOString()}*
`;

  fs.writeFileSync(summaryPath, content, "utf-8");
  console.log(`  Saved: ${summaryFilename}`);
  return true;
}

async function main() {
  console.log("=== Document Summarizer ===\n");

  // 環境変数チェック
  if (!process.env.AZURE_OPENAI_API_KEY) {
    console.error("Error: AZURE_OPENAI_API_KEY is not set");
    process.exit(1);
  }

  // summariesディレクトリを作成
  if (!fs.existsSync(summariesDir)) {
    fs.mkdirSync(summariesDir, { recursive: true });
    console.log(`Created: ${summariesDir}`);
  }

  const files = fs.readdirSync(docsDir);
  const targetFiles = files.filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return [".pdf", ".pptx"].includes(ext);
  });

  console.log(`Found ${targetFiles.length} documents to process\n`);

  let processed = 0;
  for (const file of targetFiles) {
    const filePath = path.join(docsDir, file);
    try {
      const success = await processDocument(filePath);
      if (success) processed++;
    } catch (error) {
      console.error(`  Error processing ${file}:`, error.message);
    }
  }

  console.log(`\n=== Done! Processed ${processed}/${targetFiles.length} documents ===`);
  console.log(`Summaries saved to: ${summariesDir}`);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
