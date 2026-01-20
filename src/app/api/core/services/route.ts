import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const services = await prisma.coreService.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(services);
  } catch (error) {
    console.error("Error fetching services:", error);
    return NextResponse.json(
      { error: "サービス取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, category, description, url } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "サービス名を入力してください" },
        { status: 400 }
      );
    }

    const service = await prisma.coreService.create({
      data: {
        name: name.trim(),
        category: category?.trim() || null,
        description: description?.trim() || null,
        url: url?.trim() || null,
      },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error("Error creating service:", error);
    return NextResponse.json(
      { error: "サービス作成中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, category, description, url } = body;

    if (!id) {
      return NextResponse.json(
        { error: "サービスIDが必要です" },
        { status: 400 }
      );
    }

    const service = await prisma.coreService.update({
      where: { id },
      data: {
        name: name?.trim(),
        category: category?.trim() || null,
        description: description?.trim() || null,
        url: url?.trim() || null,
      },
    });

    return NextResponse.json(service);
  } catch (error) {
    console.error("Error updating service:", error);
    return NextResponse.json(
      { error: "サービス更新中にエラーが発生しました" },
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
        { error: "サービスIDが必要です" },
        { status: 400 }
      );
    }

    await prisma.coreService.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting service:", error);
    return NextResponse.json(
      { error: "サービス削除中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
