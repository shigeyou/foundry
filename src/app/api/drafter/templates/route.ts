"use server";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// テンプレート一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const drafterId = searchParams.get("drafterId");

    if (!drafterId) {
      return NextResponse.json(
        { error: "drafterId is required" },
        { status: 400 }
      );
    }

    const templates = await prisma.drafterTemplate.findMany({
      where: { drafterId },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Failed to load templates:", error);
    return NextResponse.json(
      { error: "テンプレートの読み込みに失敗しました" },
      { status: 500 }
    );
  }
}

// テンプレート追加
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { drafterId, name, content, isDefault = false } = body;

    if (!drafterId || !name || !content) {
      return NextResponse.json(
        { error: "drafterId, name, content are required" },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();

    // isDefaultがtrueの場合、他のデフォルトを解除
    if (isDefault) {
      await prisma.drafterTemplate.updateMany({
        where: { drafterId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.drafterTemplate.create({
      data: {
        id,
        drafterId,
        name,
        content,
        isDefault,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ id: template.id, template });
  } catch (error) {
    console.error("Failed to create template:", error);
    return NextResponse.json(
      { error: "テンプレートの作成に失敗しました" },
      { status: 500 }
    );
  }
}
