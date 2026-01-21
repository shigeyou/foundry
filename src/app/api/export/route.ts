import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// CSV形式でエクスポート
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "services";
    const format = searchParams.get("format") || "csv";

    let data: Record<string, unknown>[] = [];
    let filename = "";
    let headers: string[] = [];

    switch (type) {
      case "services":
        const services = await prisma.coreService.findMany({
          orderBy: { createdAt: "desc" },
        });
        data = services.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category || "",
          description: s.description || "",
          url: s.url || "",
          createdAt: s.createdAt.toISOString(),
        }));
        headers = ["id", "name", "category", "description", "url", "createdAt"];
        filename = "services";
        break;

      case "assets":
        const assets = await prisma.coreAsset.findMany({
          orderBy: { createdAt: "desc" },
        });
        data = assets.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          description: a.description || "",
          createdAt: a.createdAt.toISOString(),
        }));
        headers = ["id", "name", "type", "description", "createdAt"];
        filename = "assets";
        break;

      case "history":
        const history = await prisma.exploration.findMany({
          orderBy: { createdAt: "desc" },
        });
        data = history.map((h) => ({
          id: h.id,
          question: h.question,
          context: h.context || "",
          constraints: h.constraints,
          result: h.result,
          createdAt: h.createdAt.toISOString(),
        }));
        headers = ["id", "question", "context", "constraints", "result", "createdAt"];
        filename = "exploration_history";
        break;

      default:
        return NextResponse.json(
          { error: "不正なエクスポートタイプです" },
          { status: 400 }
        );
    }

    if (format === "json") {
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}.json"`,
        },
      });
    }

    // CSV形式
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((h) => {
            const value = String(row[h] || "");
            // CSVエスケープ: ダブルクォートを含む場合やカンマを含む場合
            if (value.includes(",") || value.includes('"') || value.includes("\n")) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(",")
      ),
    ].join("\n");

    // BOMを追加してExcelで文字化けしないようにする
    const bom = "\uFEFF";
    return new NextResponse(bom + csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "エクスポート中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
