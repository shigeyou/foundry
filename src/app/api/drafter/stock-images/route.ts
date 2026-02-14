import { NextRequest, NextResponse } from "next/server";

interface StockImage {
  id: string;
  description: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  credit: string;
}

// Unsplash API で検索して画像を取得
async function fetchFromUnsplash(query: string, count: number): Promise<StockImage[]> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) throw new Error("NO_KEY");

  const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&count=${count}&orientation=landscape`;
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });

  if (!res.ok) {
    console.error("Unsplash API error:", res.status, await res.text());
    throw new Error("UNSPLASH_ERROR");
  }

  const photos = await res.json();
  const results: StockImage[] = [];

  for (const photo of photos) {
    try {
      // small サイズ (400px幅) を取得してbase64変換
      const imageUrl = photo.urls?.small || photo.urls?.regular;
      if (!imageUrl) continue;

      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) continue;

      const buffer = await imgRes.arrayBuffer();
      const base64 = `data:image/jpeg;base64,${Buffer.from(buffer).toString("base64")}`;

      results.push({
        id: photo.id,
        description: photo.description || photo.alt_description || query,
        base64,
        mimeType: "image/jpeg",
        width: photo.width,
        height: photo.height,
        credit: `Photo by ${photo.user?.name || "Unknown"} on Unsplash`,
      });
    } catch {
      // 個別の画像取得失敗はスキップ
      continue;
    }
  }

  return results;
}

// フォールバック: picsum.photos から取得（APIキー不要）
async function fetchFromPicsum(count: number, keywords: string[]): Promise<StockImage[]> {
  const results: StockImage[] = [];

  for (let i = 0; i < count; i++) {
    try {
      // seed で一貫性のある画像を取得
      const seed = keywords[i % keywords.length] + i;
      const url = `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/600`;
      const imgRes = await fetch(url, { redirect: "follow" });
      if (!imgRes.ok) continue;

      const buffer = await imgRes.arrayBuffer();
      const base64 = `data:image/jpeg;base64,${Buffer.from(buffer).toString("base64")}`;

      results.push({
        id: `picsum-${seed}`,
        description: `Sample image (${keywords[i % keywords.length]})`,
        base64,
        mimeType: "image/jpeg",
        width: 800,
        height: 600,
        credit: "Photo from Lorem Picsum",
      });
    } catch {
      continue;
    }
  }

  return results;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "business report";
    const count = Math.min(Number(searchParams.get("count") || "3"), 5);

    let images: StockImage[] = [];
    let source = "unsplash";

    try {
      images = await fetchFromUnsplash(query, count);
    } catch {
      // Unsplash失敗時はpicsumにフォールバック
      source = "picsum";
      const keywords = query.split(/[\s,]+/).filter(Boolean);
      images = await fetchFromPicsum(count, keywords.length > 0 ? keywords : ["sample"]);
    }

    return NextResponse.json({
      success: true,
      source,
      query,
      images,
    });
  } catch (error) {
    console.error("Stock images error:", error);
    return NextResponse.json(
      { error: "画像の取得に失敗しました" },
      { status: 500 }
    );
  }
}
