import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { processDocument } from "@/lib/rag-ingest-pipeline";
import { getFileType, parseFileContent, SUPPORTED_TYPES } from "@/lib/file-parser";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    // JSON形式のバルクインポート
    if (contentType.includes("application/json")) {
      const { documents } = await request.json();

      if (!documents || !Array.isArray(documents)) {
        return NextResponse.json(
          { error: "documents配列が必要です" },
          { status: 400 }
        );
      }

      const results = [];
      for (const doc of documents) {
        // upsert: 同名ファイルがあれば更新、なければ作成
        const existing = await prisma.rAGDocument.findFirst({ where: { filename: doc.filename } });
        if (existing) {
          await prisma.rAGDocument.update({
            where: { id: existing.id },
            data: { content: doc.content, fileType: doc.fileType, metadata: doc.metadata },
          });
          results.push({ id: existing.id, filename: doc.filename, action: "updated" });
          // チャンク再処理（バックグラウンド）
          processDocument(existing.id).catch(err =>
            console.error(`[RAG API] チャンク処理エラー: ${doc.filename}`, err)
          );
        } else {
          const created = await prisma.rAGDocument.create({
            data: {
              id: crypto.randomUUID(),
              filename: doc.filename,
              fileType: doc.fileType,
              content: doc.content,
              metadata: doc.metadata,
            },
          });
          results.push({ id: created.id, filename: created.filename, action: "created" });
          // チャンク処理（バックグラウンド）
          processDocument(created.id).catch(err =>
            console.error(`[RAG API] チャンク処理エラー: ${created.filename}`, err)
          );
        }
      }

      return NextResponse.json({
        success: true,
        imported: results.length,
        documents: results,
      });
    }

    // 従来のファイルアップロード
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "ファイルを選択してください" },
        { status: 400 }
      );
    }

    const filename = file.name;
    const fileType = getFileType(filename);

    if (!SUPPORTED_TYPES.includes(fileType)) {
      return NextResponse.json(
        {
          error: `サポートされていないファイル形式です: ${fileType}。対応形式: ${SUPPORTED_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { content, metadata } = await parseFileContent(file);

    // DBに保存
    const doc = await prisma.rAGDocument.create({
      data: {
        id: crypto.randomUUID(),
        filename,
        fileType,
        content,
        metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
      },
    });

    // チャンク処理（バックグラウンド）
    processDocument(doc.id).catch(err =>
      console.error(`[RAG API] チャンク処理エラー: ${filename}`, err)
    );

    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        filename: doc.filename,
        fileType: doc.fileType,
        contentLength: content.length,
        metadata,
      },
      message: `${filename} をインポートしました（${content.length.toLocaleString()}文字）`,
    });
  } catch (error) {
    console.error("RAG import error:", error);
    return NextResponse.json(
      { error: `インポート中にエラーが発生しました: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

// RAGドキュメント一覧を取得（idパラメータがあれば詳細を取得）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    // 特定のドキュメントの詳細を取得
    if (id) {
      const document = await prisma.rAGDocument.findUnique({
        where: { id },
      });

      if (!document) {
        return NextResponse.json(
          { error: "ドキュメントが見つかりません" },
          { status: 404 }
        );
      }

      return NextResponse.json({ document });
    }

    // 一覧を取得
    const documents = await prisma.rAGDocument.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        filename: true,
        fileType: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("RAG list error:", error);
    return NextResponse.json(
      { error: "ドキュメント一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// RAGドキュメントを更新（ファイル名など）
export async function PUT(request: NextRequest) {
  try {
    const { id, filename } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "ドキュメントIDが必要です" },
        { status: 400 }
      );
    }

    const updated = await prisma.rAGDocument.update({
      where: { id },
      data: { filename },
    });

    return NextResponse.json({ success: true, document: updated });
  } catch (error) {
    console.error("RAG update error:", error);
    return NextResponse.json(
      { error: "ドキュメントの更新に失敗しました" },
      { status: 500 }
    );
  }
}

// RAGドキュメントを削除
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "ドキュメントIDが必要です" },
        { status: 400 }
      );
    }

    // 関連チャンクも削除
    await prisma.rAGChunk.deleteMany({ where: { documentId: id } });
    await prisma.rAGDocument.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("RAG delete error:", error);
    return NextResponse.json(
      { error: "ドキュメントの削除に失敗しました" },
      { status: 500 }
    );
  }
}
