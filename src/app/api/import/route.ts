import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// CSVをパース
function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.replace(/^"|"$/g, "") || "";
    });
    rows.push(row);
  }

  return rows;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;

    if (!file) {
      return NextResponse.json(
        { error: "ファイルを選択してください" },
        { status: 400 }
      );
    }

    const content = await file.text();
    // BOMを除去
    const cleanContent = content.replace(/^\uFEFF/, "");

    let importedCount = 0;
    let skippedCount = 0;

    if (type === "services") {
      const rows = parseCSV(cleanContent);
      for (const row of rows) {
        if (!row.name || row.name.trim() === "") {
          skippedCount++;
          continue;
        }
        await prisma.coreService.create({
          data: {
            name: row.name.trim(),
            category: row.category?.trim() || null,
            description: row.description?.trim() || null,
            url: row.url?.trim() || null,
          },
        });
        importedCount++;
      }
    } else if (type === "assets") {
      const rows = parseCSV(cleanContent);
      for (const row of rows) {
        if (!row.name || row.name.trim() === "" || !row.type || row.type.trim() === "") {
          skippedCount++;
          continue;
        }
        await prisma.coreAsset.create({
          data: {
            name: row.name.trim(),
            type: row.type.trim(),
            description: row.description?.trim() || null,
          },
        });
        importedCount++;
      }
    } else {
      return NextResponse.json(
        { error: "不正なインポートタイプです" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      message: `${importedCount}件をインポートしました${skippedCount > 0 ? `（${skippedCount}件スキップ）` : ""}`,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "インポート中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
