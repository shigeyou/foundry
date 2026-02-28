import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

// POST: プロジェクト作成
export async function POST(request: NextRequest) {
  try {
    const { name, department, description } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "プロジェクト名は必須です" }, { status: 400 });
    }

    const project = await prisma.bottleneckProject.create({
      data: {
        id: `bnp-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        name: name.trim(),
        department: department?.trim() || null,
        description: description?.trim() || null,
      },
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error("[Bottleneck Project] Create error:", error);
    return NextResponse.json({ error: "プロジェクトの作成に失敗しました" }, { status: 500 });
  }
}

// GET: プロジェクト一覧 or 詳細
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const project = await prisma.bottleneckProject.findUnique({
        where: { id },
        include: {
          documents: {
            select: { id: true, filename: true, fileType: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          },
          flows: {
            select: { id: true, createdAt: true, updatedAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          reports: {
            select: { id: true, status: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: { select: { documents: true, flows: true, reports: true } },
        },
      });

      if (!project) {
        return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 });
      }

      return NextResponse.json({ project });
    }

    const projects = await prisma.bottleneckProject.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { documents: true, flows: true, reports: true } },
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("[Bottleneck Project] List error:", error);
    return NextResponse.json({ error: "プロジェクト一覧の取得に失敗しました" }, { status: 500 });
  }
}

// DELETE: プロジェクト削除（カスケード）
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "プロジェクトIDが必要です" }, { status: 400 });
    }

    await prisma.bottleneckProject.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Bottleneck Project] Delete error:", error);
    return NextResponse.json({ error: "プロジェクトの削除に失敗しました" }, { status: 500 });
  }
}
