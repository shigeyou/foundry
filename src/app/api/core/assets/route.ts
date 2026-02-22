import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const assets = await prisma.coreAsset.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(assets);
  } catch (error) {
    console.error("Error fetching assets:", error);
    return NextResponse.json(
      { error: "資産取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, description } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "資産名を入力してください" },
        { status: 400 }
      );
    }

    if (!type || type.trim() === "") {
      return NextResponse.json(
        { error: "資産タイプを選択してください" },
        { status: 400 }
      );
    }

    const asset = await prisma.coreAsset.create({
      data: {
        id: crypto.randomUUID(),
        name: name.trim(),
        type: type.trim(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error("Error creating asset:", error);
    return NextResponse.json(
      { error: "資産作成中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, type, description } = body;

    if (!id) {
      return NextResponse.json(
        { error: "資産IDが必要です" },
        { status: 400 }
      );
    }

    const asset = await prisma.coreAsset.update({
      where: { id },
      data: {
        name: name?.trim(),
        type: type?.trim(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json(asset);
  } catch (error) {
    console.error("Error updating asset:", error);
    return NextResponse.json(
      { error: "資産更新中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "資産IDが必要です" },
        { status: 400 }
      );
    }

    await prisma.coreAsset.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting asset:", error);
    return NextResponse.json(
      { error: "資産削除中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
