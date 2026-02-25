import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import fs from "fs";
import path from "path";

interface SeedDocument {
  filename: string;
  fileType: string;
  content: string;
  metadata: string | null;
}

// GET: シードデータの状態確認
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const detail = searchParams.get("detail") === "true";

    const [ragCount, explorationCount, topStrategyCount, strategyDecisionCount] = await Promise.all([
      prisma.rAGDocument.count(),
      prisma.exploration.count(),
      prisma.topStrategy.count(),
      prisma.strategyDecision.count(),
    ]);

    const ragSeedPath = path.join(process.cwd(), "prisma/seed-data/rag-documents.json");
    const explorationSeedPath = path.join(process.cwd(), "prisma/seed-data/exploration-data.json");

    // 詳細モード: RAGドキュメントのcontent長さも表示
    let ragDocumentDetails = null;
    if (detail) {
      const ragDocs = await prisma.rAGDocument.findMany({
        select: {
          id: true,
          filename: true,
          fileType: true,
          content: true,
        },
      });
      ragDocumentDetails = ragDocs.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        fileType: doc.fileType,
        contentLength: doc.content?.length || 0,
        hasContent: !!(doc.content && doc.content.length > 0),
      }));
    }

    return NextResponse.json({
      ragDocumentCount: ragCount,
      explorationCount,
      topStrategyCount,
      strategyDecisionCount,
      ragSeedFileExists: fs.existsSync(ragSeedPath),
      explorationSeedFileExists: fs.existsSync(explorationSeedPath),
      needsRagSeeding: ragCount === 0,
      needsExplorationSeeding: explorationCount === 0,
      ...(ragDocumentDetails && { ragDocumentDetails }),
    });
  } catch (error) {
    console.error("Seed status error:", error);
    return NextResponse.json(
      { error: "シード状態の確認に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: シードデータを読み込み
// クエリパラメータ: type=rag|exploration|all, force=true で強制シード
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";
    const force = searchParams.get("force") === "true";

    const results: Record<string, unknown> = {};

    // RAGドキュメントのシード
    if (type === "rag" || type === "all") {
      const existingRagCount = await prisma.rAGDocument.count();
      if (force || existingRagCount === 0) {
        const seedFilePath = path.join(process.cwd(), "prisma/seed-data/rag-documents.json");

        if (fs.existsSync(seedFilePath)) {
          if (force && existingRagCount > 0) {
            // webスコープ（クローラー生成）は保持し、それ以外を削除
            await prisma.rAGDocument.deleteMany({ where: { scope: { not: "web" } } });
          }

          const seedData = JSON.parse(fs.readFileSync(seedFilePath, "utf-8"));
          const documents: SeedDocument[] = seedData.documents || [];

          for (const doc of documents) {
            // 同名ファイルが既存なら更新、なければ作成（重複防止）
            const existing = await prisma.rAGDocument.findFirst({ where: { filename: doc.filename } });
            const metadataStr = typeof doc.metadata === 'object' && doc.metadata !== null ? JSON.stringify(doc.metadata) : doc.metadata;
            if (existing) {
              await prisma.rAGDocument.update({
                where: { id: existing.id },
                data: { content: doc.content, fileType: doc.fileType, metadata: metadataStr },
              });
            } else {
              await prisma.rAGDocument.create({
                data: {
                  id: crypto.randomUUID(),
                  filename: doc.filename,
                  fileType: doc.fileType,
                  content: doc.content,
                  metadata: metadataStr,
                },
              });
            }
          }
          results.rag = { seeded: documents.length };
        } else {
          results.rag = { error: "シードファイルが見つかりません" };
        }
      } else {
        results.rag = { skipped: true, existingCount: existingRagCount };
      }
    }

    // 探索データのシード
    if (type === "exploration" || type === "all") {
      const existingExplorationCount = await prisma.exploration.count();
      if (force || existingExplorationCount === 0) {
        const seedFilePath = path.join(process.cwd(), "prisma/seed-data/exploration-data.json");

        if (fs.existsSync(seedFilePath)) {
          if (force) {
            // 強制シードの場合は既存データを削除
            await prisma.strategyDecision.deleteMany();
            await prisma.topStrategy.deleteMany();
            await prisma.exploration.deleteMany();
            await prisma.learningMemory.deleteMany();
            await prisma.companyProfile.deleteMany();
            await prisma.defaultSwot.deleteMany();
            await prisma.coreAsset.deleteMany();
            await prisma.coreService.deleteMany();
          }

          const seedData = JSON.parse(fs.readFileSync(seedFilePath, "utf-8"));
          const counts: Record<string, number> = {};

          // CompanyProfile
          if (seedData.companyProfile) {
            await prisma.companyProfile.create({
              data: {
                id: seedData.companyProfile.id || "default",
                name: seedData.companyProfile.name,
                shortName: seedData.companyProfile.shortName,
                description: seedData.companyProfile.description,
                background: seedData.companyProfile.background,
                techStack: seedData.companyProfile.techStack,
                parentCompany: seedData.companyProfile.parentCompany,
                parentRelation: seedData.companyProfile.parentRelation,
                industry: seedData.companyProfile.industry,
                additionalContext: seedData.companyProfile.additionalContext,
              },
            });
            counts.companyProfile = 1;
          }

          // DefaultSwot
          if (seedData.defaultSwot) {
            await prisma.defaultSwot.create({
              data: {
                id: seedData.defaultSwot.id || "default",
                strengths: seedData.defaultSwot.strengths,
                weaknesses: seedData.defaultSwot.weaknesses,
                opportunities: seedData.defaultSwot.opportunities,
                threats: seedData.defaultSwot.threats,
                summary: seedData.defaultSwot.summary,
                updatedBy: seedData.defaultSwot.updatedBy,
              },
            });
            counts.defaultSwot = 1;
          }

          // CoreAssets
          if (seedData.coreAssets?.length > 0) {
            for (const asset of seedData.coreAssets) {
              await prisma.coreAsset.create({
                data: {
                  id: crypto.randomUUID(),
                  name: asset.name,
                  type: asset.type,
                  description: asset.description,
                },
              });
            }
            counts.coreAssets = seedData.coreAssets.length;
          }

          // CoreServices
          if (seedData.coreServices?.length > 0) {
            for (const service of seedData.coreServices) {
              await prisma.coreService.create({
                data: {
                  id: crypto.randomUUID(),
                  name: service.name,
                  category: service.category,
                  description: service.description,
                  url: service.url,
                },
              });
            }
            counts.coreServices = seedData.coreServices.length;
          }

          // Explorations
          if (seedData.explorations?.length > 0) {
            for (const exploration of seedData.explorations) {
              await prisma.exploration.create({
                data: {
                  id: exploration.id,
                  question: exploration.question,
                  context: exploration.context,
                  constraints: exploration.constraints,
                  status: exploration.status,
                  result: exploration.result,
                  error: exploration.error,
                },
              });
            }
            counts.explorations = seedData.explorations.length;
          }

          // TopStrategies
          if (seedData.topStrategies?.length > 0) {
            for (const strategy of seedData.topStrategies) {
              await prisma.topStrategy.create({
                data: {
                  id: strategy.id,
                  explorationId: strategy.explorationId,
                  name: strategy.name,
                  reason: strategy.reason,
                  howToObtain: strategy.howToObtain,
                  totalScore: strategy.totalScore,
                  scores: strategy.scores,
                  question: strategy.question,
                  judgment: strategy.judgment,
                  learningExtracted: strategy.learningExtracted,
                },
              });
            }
            counts.topStrategies = seedData.topStrategies.length;
          }

          // StrategyDecisions
          if (seedData.strategyDecisions?.length > 0) {
            for (const decision of seedData.strategyDecisions) {
              await prisma.strategyDecision.create({
                data: {
                  id: decision.id,
                  explorationId: decision.explorationId,
                  strategyName: decision.strategyName,
                  decision: decision.decision,
                  reason: decision.reason,
                  feasibilityNote: decision.feasibilityNote,
                },
              });
            }
            counts.strategyDecisions = seedData.strategyDecisions.length;
          }

          // LearningMemories
          if (seedData.learningMemories?.length > 0) {
            for (const memory of seedData.learningMemories) {
              await prisma.learningMemory.create({
                data: {
                  id: memory.id,
                  type: memory.type,
                  category: memory.category,
                  pattern: memory.pattern,
                  examples: memory.examples,
                  evidence: memory.evidence,
                  confidence: memory.confidence,
                  validationCount: memory.validationCount,
                  successRate: memory.successRate,
                  usedCount: memory.usedCount,
                  lastUsedAt: memory.lastUsedAt ? new Date(memory.lastUsedAt) : null,
                  isActive: memory.isActive,
                },
              });
            }
            counts.learningMemories = seedData.learningMemories.length;
          }

          results.exploration = { seeded: counts };
        } else {
          results.exploration = { error: "シードファイルが見つかりません" };
        }
      } else {
        results.exploration = { skipped: true, existingCount: existingExplorationCount };
      }
    }

    return NextResponse.json({
      success: true,
      force,
      type,
      results,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: `シードに失敗しました: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

// DELETE: 探索データのみクリア（会社情報やRAGは残す）
// クエリパラメータ: user-only=true で自分のデータのみ削除、指定なしで全データ削除（管理者用）
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userOnly = searchParams.get("user-only") === "true";

    if (userOnly) {
      // ユーザー別のデータのみ削除
      const user = await getCurrentUser();

      const [
        deletedDecisions,
        deletedStrategies,
        deletedExplorations,
        deletedMemories,
        deletedAutoExploreRuns,
        deletedMetaAnalysisRuns,
      ] = await Promise.all([
        prisma.strategyDecision.deleteMany({ where: { userId: user.id } }),
        prisma.topStrategy.deleteMany({ where: { userId: user.id } }),
        prisma.exploration.deleteMany({ where: { userId: user.id } }),
        prisma.learningMemory.deleteMany({ where: { userId: user.id } }),
        prisma.autoExploreRun.deleteMany({ where: { userId: user.id } }),
        prisma.metaAnalysisRun.deleteMany({ where: { userId: user.id } }),
      ]);

      return NextResponse.json({
        success: true,
        userOnly: true,
        userId: user.id,
        userName: user.name,
        deleted: {
          strategyDecisions: deletedDecisions.count,
          topStrategies: deletedStrategies.count,
          explorations: deletedExplorations.count,
          learningMemories: deletedMemories.count,
          autoExploreRuns: deletedAutoExploreRuns.count,
          metaAnalysisRuns: deletedMetaAnalysisRuns.count,
        },
      });
    } else {
      // 全探索関連データを削除（管理者用）
      const [
        deletedDecisions,
        deletedStrategies,
        deletedExplorations,
        deletedMemories,
      ] = await Promise.all([
        prisma.strategyDecision.deleteMany(),
        prisma.topStrategy.deleteMany(),
        prisma.exploration.deleteMany(),
        prisma.learningMemory.deleteMany(),
      ]);

      return NextResponse.json({
        success: true,
        userOnly: false,
        deleted: {
          strategyDecisions: deletedDecisions.count,
          topStrategies: deletedStrategies.count,
          explorations: deletedExplorations.count,
          learningMemories: deletedMemories.count,
        },
      });
    }
  } catch (error) {
    console.error("Clear exploration data error:", error);
    return NextResponse.json(
      { error: `データ削除に失敗しました: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
