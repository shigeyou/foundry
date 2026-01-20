import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWinningStrategies } from "@/lib/claude";
import { generateRAGContext } from "@/lib/rag";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, context, constraintIds } = body;

    if (!question || question.trim() === "") {
      return NextResponse.json(
        { error: "問いを入力してください" },
        { status: 400 }
      );
    }

    // Fetch data in parallel
    const [coreServices, coreAssets, defaultConstraints, ragContext] =
      await Promise.all([
        prisma.coreService.findMany(),
        prisma.coreAsset.findMany(),
        prisma.constraint.findMany({ where: { isDefault: true } }),
        generateRAGContext(),
      ]);

    // Format core services
    const servicesText = coreServices
      .map(
        (s) =>
          `- ${s.name}${s.category ? ` (${s.category})` : ""}${s.description ? `: ${s.description}` : ""}`
      )
      .join("\n");

    // Format core assets
    const assetsText = coreAssets
      .map(
        (a) =>
          `- ${a.name} [${a.type}]${a.description ? `: ${a.description}` : ""}`
      )
      .join("\n");

    // Format constraints
    const constraintsText = defaultConstraints
      .map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ""}`)
      .join("\n");

    // Generate winning strategies
    const result = await generateWinningStrategies(
      question,
      context || "",
      servicesText,
      assetsText,
      constraintsText,
      ragContext
    );

    // Save to history
    await prisma.exploration.create({
      data: {
        question,
        context: context || null,
        constraints: JSON.stringify(constraintIds || []),
        result: JSON.stringify(result),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Exploration error:", error);
    return NextResponse.json(
      { error: "探索中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
