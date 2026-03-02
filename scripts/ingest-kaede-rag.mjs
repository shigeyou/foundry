/**
 * kaede_ver10/agent_docs/raw_documents の全ファイルを Foundry の RAG に登録するスクリプト
 * Node.js 20+ の組み込み fetch/FormData/Blob を使用
 */
import fs from "fs";
import path from "path";

const INGEST_DIR = "C:/Dev/kaede_ver10/agent_docs/raw_documents";
const API_URL = "http://localhost:3006/api/rag";
const SUPPORTED_EXTS = new Set(["pdf", "txt", "md", "docx", "csv", "pptx"]);
// _ingest_manifest.jsonはJSONだが内容がマニフェストなのでスキップ
const SKIP_FILES = new Set(["_ingest_manifest.json"]);

async function uploadFile(filePath, filename) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (SKIP_FILES.has(filename)) {
    console.log(`  ⏭ スキップ（除外リスト）: ${filename}`);
    return "skipped";
  }

  if (!SUPPORTED_EXTS.has(ext)) {
    console.log(`  ⏭ スキップ（未対応形式 .${ext}）: ${filename}`);
    return "skipped";
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer]);

    const formData = new FormData();
    formData.set("file", blob, filename);

    const res = await fetch(API_URL, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`  ✅ 登録成功: ${filename} (ID: ${data.id})`);
      return "success";
    } else {
      let errMsg = res.status;
      try {
        const data = await res.json();
        errMsg = data.error || res.status;
      } catch {}
      console.log(`  ❌ 登録失敗: ${filename} - ${errMsg}`);
      return "failed";
    }
  } catch (err) {
    console.log(`  ❌ エラー: ${filename} - ${err.message}`);
    return "failed";
  }
}

async function main() {
  console.log("=== kaede_ver10 RAG登録開始 ===\n");

  const files = fs.readdirSync(INGEST_DIR);
  console.log(`ファイル総数: ${files.length}\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const filename of files) {
    const filePath = path.join(INGEST_DIR, filename);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) continue;

    process.stdout.write(`処理中: ${filename}\n`);
    const result = await uploadFile(filePath, filename);

    if (result === "success") success++;
    else if (result === "skipped") skipped++;
    else failed++;

    // サーバー負荷軽減
    await new Promise(r => setTimeout(r, 200));
  }

  console.log("\n=== 完了 ===");
  console.log(`✅ 成功: ${success}件`);
  console.log(`⏭ スキップ: ${skipped}件`);
  console.log(`❌ 失敗: ${failed}件`);
}

main().catch(console.error);
