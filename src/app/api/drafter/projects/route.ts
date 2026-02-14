"use server";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// プロジェクト一覧取得
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

    const projects = await prisma.drafterProject.findMany({
      where: { drafterId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { error: "プロジェクトの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// プロジェクト作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      drafterId,
      name,
      templateId,
      meetingOverview,
      pastMinutes,
      additionalInstructions,
    } = body;

    if (!drafterId || !name) {
      return NextResponse.json(
        { error: "drafterId and name are required" },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const now = new Date();

    await prisma.drafterProject.create({
      data: {
        id,
        drafterId,
        name,
        templateId: templateId || null,
        meetingOverview: meetingOverview || null,
        pastMinutesJson: pastMinutes ? JSON.stringify(pastMinutes) : null,
        additionalInstructions: additionalInstructions || null,
        createdAt: now,
        updatedAt: now,
      },
    });

    return NextResponse.json({ id, success: true });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "プロジェクトの作成に失敗しました" },
      { status: 500 }
    );
  }
}
