"use server";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// テンプレート更新
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, content, isDefault } = body;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (content !== undefined) updateData.content = content;

    // isDefaultを更新する場合
    if (isDefault !== undefined) {
      if (isDefault) {
        // 現在のテンプレートのdrafterIdを取得
        const current = await prisma.drafterTemplate.findUnique({ where: { id } });
        if (current) {
          // 他のデフォルトを解除
          await prisma.drafterTemplate.updateMany({
            where: { drafterId: current.drafterId, isDefault: true },
            data: { isDefault: false },
          });
        }
      }
      updateData.isDefault = isDefault;
    }

    const template = await prisma.drafterTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Failed to update template:", error);
    return NextResponse.json(
      { error: "テンプレートの更新に失敗しました" },
      { status: 500 }
    );
  }
}

// テンプレート削除
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    await prisma.drafterTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete template:", error);
    return NextResponse.json(
      { error: "テンプレートの削除に失敗しました" },
      { status: 500 }
    );
  }
}
