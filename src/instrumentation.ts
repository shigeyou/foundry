export async function register() {
  // サーバーサイドでのみ実行
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { prisma } = await import("@/lib/db");
    const fs = await import("fs");
    const path = await import("path");

    try {
      // RAGドキュメントのシード
      const ragCount = await prisma.rAGDocument.count();

      if (ragCount === 0) {
        console.log("[Auto-Seed] RAGドキュメントが0件です。シードを実行します...");

        const seedFilePath = path.join(process.cwd(), "prisma/seed-data/rag-documents.json");

        if (fs.existsSync(seedFilePath)) {
          const seedData = JSON.parse(fs.readFileSync(seedFilePath, "utf-8"));
          const documents = seedData.documents || [];

          for (const doc of documents) {
            await prisma.rAGDocument.create({
              data: {
                filename: doc.filename,
                fileType: doc.fileType,
                content: doc.content,
                metadata: doc.metadata,
              },
            });
          }

          console.log(`[Auto-Seed] ${documents.length}件のRAGドキュメントをシードしました`);
        } else {
          console.log("[Auto-Seed] RAGシードファイルが見つかりません:", seedFilePath);
        }
      } else {
        console.log(`[Auto-Seed] RAGドキュメントが${ragCount}件存在します。シードをスキップします`);
      }

      // 探索データのシード
      const explorationCount = await prisma.exploration.count();

      if (explorationCount === 0) {
        console.log("[Auto-Seed] 探索データが0件です。シードを実行します...");

        const explorationSeedPath = path.join(process.cwd(), "prisma/seed-data/exploration-data.json");

        if (fs.existsSync(explorationSeedPath)) {
          const seedData = JSON.parse(fs.readFileSync(explorationSeedPath, "utf-8"));

          // CompanyProfile
          if (seedData.companyProfile) {
            const existingProfile = await prisma.companyProfile.findFirst();
            if (!existingProfile) {
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
              console.log("[Auto-Seed] CompanyProfileをシードしました");
            }
          }

          // DefaultSwot
          if (seedData.defaultSwot) {
            const existingSwot = await prisma.defaultSwot.findFirst();
            if (!existingSwot) {
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
              console.log("[Auto-Seed] DefaultSwotをシードしました");
            }
          }

          // CoreAssets
          if (seedData.coreAssets && seedData.coreAssets.length > 0) {
            const existingAssets = await prisma.coreAsset.count();
            if (existingAssets === 0) {
              for (const asset of seedData.coreAssets) {
                await prisma.coreAsset.create({
                  data: {
                    name: asset.name,
                    type: asset.type,
                    description: asset.description,
                  },
                });
              }
              console.log(`[Auto-Seed] ${seedData.coreAssets.length}件のCoreAssetをシードしました`);
            }
          }

          // CoreServices
          if (seedData.coreServices && seedData.coreServices.length > 0) {
            const existingServices = await prisma.coreService.count();
            if (existingServices === 0) {
              for (const service of seedData.coreServices) {
                await prisma.coreService.create({
                  data: {
                    name: service.name,
                    category: service.category,
                    description: service.description,
                    url: service.url,
                  },
                });
              }
              console.log(`[Auto-Seed] ${seedData.coreServices.length}件のCoreServiceをシードしました`);
            }
          }

          // Explorations
          if (seedData.explorations && seedData.explorations.length > 0) {
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
            console.log(`[Auto-Seed] ${seedData.explorations.length}件のExplorationをシードしました`);
          }

          // TopStrategies
          if (seedData.topStrategies && seedData.topStrategies.length > 0) {
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
            console.log(`[Auto-Seed] ${seedData.topStrategies.length}件のTopStrategyをシードしました`);
          }

          // StrategyDecisions
          if (seedData.strategyDecisions && seedData.strategyDecisions.length > 0) {
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
            console.log(`[Auto-Seed] ${seedData.strategyDecisions.length}件のStrategyDecisionをシードしました`);
          }

          // LearningMemories
          if (seedData.learningMemories && seedData.learningMemories.length > 0) {
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
            console.log(`[Auto-Seed] ${seedData.learningMemories.length}件のLearningMemoryをシードしました`);
          }

          console.log("[Auto-Seed] 探索データのシードが完了しました");
        } else {
          console.log("[Auto-Seed] 探索データシードファイルが見つかりません:", explorationSeedPath);
        }
      } else {
        console.log(`[Auto-Seed] 探索データが${explorationCount}件存在します。シードをスキップします`);
      }
    } catch (error) {
      console.error("[Auto-Seed] エラー:", error);
    }
  }
}
