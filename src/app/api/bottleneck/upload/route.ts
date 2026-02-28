import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { parseFileContent, getFileType, SUPPORTED_TYPES } from "@/lib/file-parser";

// POST: ドキュメントアップロード
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const projectId = formData.get("projectId") as string;

    if (!file) {
      return NextResponse.json({ error: "ファイルを選択してください" }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: "プロジェクトIDが必要です" }, { status: 400 });
    }

    // プロジェクト存在確認
    const project = await prisma.bottleneckProject.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 });
    }

    const fileType = getFileType(file.name);
    if (!SUPPORTED_TYPES.includes(fileType)) {
      return NextResponse.json(
        { error: `サポートされていないファイル形式です: ${fileType}。対応形式: ${SUPPORTED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // ファイルパース
    const { content, metadata } = await parseFileContent(file);

    // DB保存
    const doc = await prisma.bottleneckDocument.create({
      data: {
        id: `bnd-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        projectId,
        filename: file.name,
        fileType,
        content,
        metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
      },
    });

    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        filename: doc.filename,
        fileType: doc.fileType,
        contentLength: content.length,
        createdAt: doc.createdAt,
      },
    });
  } catch (error) {
    console.error("[Bottleneck Upload] Error:", error);
    return NextResponse.json(
      { error: `アップロード中にエラーが発生しました: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

// DELETE: ドキュメント削除
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ドキュメントIDが必要です" }, { status: 400 });
    }

    await prisma.bottleneckDocument.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Bottleneck Upload] Delete error:", error);
    return NextResponse.json({ error: "ドキュメントの削除に失敗しました" }, { status: 500 });
  }
}
