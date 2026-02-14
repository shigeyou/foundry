"use server";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// プロジェクト取得
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const project = await prisma.drafterProject.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json(
        { error: "プロジェクトが見つかりません" },
        { status: 404 }
      );
    }

    // pastMinutesJsonをパースして返す
    const pastMinutes = project.pastMinutesJson
      ? JSON.parse(project.pastMinutesJson)
      : [];

    return NextResponse.json({
      project: {
        ...project,
        pastMinutes,
      },
    });
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json(
      { error: "プロジェクトの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// プロジェクト更新
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      templateId,
      meetingOverview,
      pastMinutes,
      additionalInstructions,
    } = body;

    const existing = await prisma.drafterProject.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "プロジェクトが見つかりません" },
        { status: 404 }
      );
    }

    await prisma.drafterProject.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        templateId: templateId !== undefined ? templateId : existing.templateId,
        meetingOverview:
          meetingOverview !== undefined
            ? meetingOverview
            : existing.meetingOverview,
        pastMinutesJson:
          pastMinutes !== undefined
            ? JSON.stringify(pastMinutes)
            : existing.pastMinutesJson,
        additionalInstructions:
          additionalInstructions !== undefined
            ? additionalInstructions
            : existing.additionalInstructions,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json(
      { error: "プロジェクトの更新に失敗しました" },
      { status: 500 }
    );
  }
}

// プロジェクト削除
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    await prisma.drafterProject.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json(
      { error: "プロジェクトの削除に失敗しました" },
      { status: 500 }
    );
  }
}
