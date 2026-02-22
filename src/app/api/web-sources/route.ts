import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

// GET: 全てのネット情報を取得
export async function GET() {
  try {
    const webSources = await prisma.webSource.findMany({
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ webSources });
  } catch (error) {
    console.error("Failed to fetch web sources:", error);
    return NextResponse.json(
      { error: "ネット情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: 新しいネット情報を追加
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, url, description } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: "名前とURLは必須です" },
        { status: 400 }
      );
    }

    // URL形式の簡易バリデーション
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "有効なURLを入力してください" },
        { status: 400 }
      );
    }

    const webSource = await prisma.webSource.create({
      data: {
        id: crypto.randomUUID(),
        name,
        url,
        description: description || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${name} を追加しました`,
      webSource,
    });
  } catch (error) {
    console.error("Failed to create web source:", error);
    return NextResponse.json(
      { error: "ネット情報の追加に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: ネット情報を削除
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "IDは必須です" },
        { status: 400 }
      );
    }

    await prisma.webSource.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "削除しました",
    });
  } catch (error) {
    console.error("Failed to delete web source:", error);
    return NextResponse.json(
      { error: "ネット情報の削除に失敗しました" },
      { status: 500 }
    );
  }
}
