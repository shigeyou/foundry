import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface CompanyProfileData {
  name: string;
  shortName?: string;
  description?: string;
  background?: string;
  techStack?: string;
  parentCompany?: string;
  parentRelation?: string;
  industry?: string;
  additionalContext?: string;
}

// GET: 対象企業プロファイルを取得
export async function GET() {
  try {
    const profile = await prisma.companyProfile.findUnique({
      where: { id: "default" },
    });

    if (!profile) {
      // デフォルト値を返す（未設定の場合）
      return NextResponse.json({
        profile: null,
        isConfigured: false,
      });
    }

    return NextResponse.json({
      profile,
      isConfigured: true,
    });
  } catch (error) {
    console.error("Failed to fetch company profile:", error);
    return NextResponse.json(
      { error: "プロファイルの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: 対象企業プロファイルを保存
export async function POST(request: NextRequest) {
  try {
    const body: CompanyProfileData = await request.json();

    if (!body.name || body.name.trim() === "") {
      return NextResponse.json(
        { error: "会社名は必須です" },
        { status: 400 }
      );
    }

    const profile = await prisma.companyProfile.upsert({
      where: { id: "default" },
      update: {
        name: body.name.trim(),
        shortName: body.shortName?.trim() || null,
        description: body.description?.trim() || null,
        background: body.background?.trim() || null,
        techStack: body.techStack?.trim() || null,
        parentCompany: body.parentCompany?.trim() || null,
        parentRelation: body.parentRelation?.trim() || null,
        industry: body.industry?.trim() || null,
        additionalContext: body.additionalContext?.trim() || null,
      },
      create: {
        id: "default",
        name: body.name.trim(),
        shortName: body.shortName?.trim() || null,
        description: body.description?.trim() || null,
        background: body.background?.trim() || null,
        techStack: body.techStack?.trim() || null,
        parentCompany: body.parentCompany?.trim() || null,
        parentRelation: body.parentRelation?.trim() || null,
        industry: body.industry?.trim() || null,
        additionalContext: body.additionalContext?.trim() || null,
      },
    });

    return NextResponse.json({
      profile,
      message: "プロファイルを保存しました",
    });
  } catch (error) {
    console.error("Failed to save company profile:", error);
    return NextResponse.json(
      { error: "プロファイルの保存に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: プロファイルをリセット
export async function DELETE() {
  try {
    await prisma.companyProfile.deleteMany({
      where: { id: "default" },
    });

    return NextResponse.json({
      message: "プロファイルをリセットしました",
    });
  } catch (error) {
    console.error("Failed to delete company profile:", error);
    return NextResponse.json(
      { error: "プロファイルの削除に失敗しました" },
      { status: 500 }
    );
  }
}
