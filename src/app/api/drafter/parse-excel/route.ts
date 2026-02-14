import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ファイルが必要です" }, { status: 400 });
    }

    const fileName = file.name;
    const ext = fileName.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      // CSV: テキストとして読み込みMarkdownテーブルに変換
      const text = await file.text();
      const content = csvToMarkdownTable(text);
      return NextResponse.json({
        success: true,
        fileName,
        fileType: "csv",
        content,
        size: file.size,
      });
    }

    if (ext === "xlsx" || ext === "xls") {
      // Excel: xlsxパッケージで解析
      try {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });

        const sheets: { name: string; content: string }[] = [];
        let allContent = "";

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csvData = XLSX.utils.sheet_to_csv(sheet);
          const mdTable = csvToMarkdownTable(csvData);
          sheets.push({ name: sheetName, content: mdTable });
          allContent += `### シート: ${sheetName}\n\n${mdTable}\n\n`;
        }

        return NextResponse.json({
          success: true,
          fileName,
          fileType: "xlsx",
          content: allContent.trim(),
          sheets,
          size: file.size,
        });
      } catch {
        return NextResponse.json(
          { error: "Excelファイルの解析に失敗しました。xlsxパッケージがインストールされているか確認してください。" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: `未対応のファイル形式です: .${ext}` },
      { status: 400 }
    );
  } catch (error) {
    console.error("Excel parse error:", error);
    return NextResponse.json(
      { error: "ファイルの解析中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

function csvToMarkdownTable(csv: string): string {
  const lines = csv.split("\n").filter((line) => line.trim());
  if (lines.length === 0) return "[空のデータ]";

  const rows = lines.map((line) => parseCsvLine(line));
  if (rows.length === 0) return "[空のデータ]";

  // 最大列数を取得
  const maxCols = Math.max(...rows.map((r) => r.length));

  // ヘッダー行
  const header = rows[0].map((cell) => cell.trim() || " ");
  while (header.length < maxCols) header.push(" ");

  // セパレーター
  const separator = header.map(() => "---");

  // データ行
  const dataRows = rows.slice(1).map((row) => {
    while (row.length < maxCols) row.push("");
    return row.map((cell) => cell.trim() || " ");
  });

  const headerLine = `| ${header.join(" | ")} |`;
  const separatorLine = `| ${separator.join(" | ")} |`;
  const dataLines = dataRows.map((row) => `| ${row.join(" | ")} |`);

  return [headerLine, separatorLine, ...dataLines].join("\n");
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}
