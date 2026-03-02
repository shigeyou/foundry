export async function register() {
  // サーバーサイドでのみ実行
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { prisma } = await import("@/lib/db");
    const fs = await import("fs");
    const path = await import("path");

    try {
      // WebSourceのシード
      const webSourceCount = await prisma.webSource.count();

      if (webSourceCount === 0) {
        console.log("[Auto-Seed] WebSourceが0件です。シードを実行します...");

        const webSourceSeedPath = path.join(process.cwd(), "prisma/seed-data/web-sources.json");

        if (fs.existsSync(webSourceSeedPath)) {
          const seedData = JSON.parse(fs.readFileSync(webSourceSeedPath, "utf-8"));
          const webSources = seedData.webSources || [];

          for (const source of webSources) {
            await prisma.webSource.create({
              data: {
                id: source.id || crypto.randomUUID(),
                name: source.name,
                url: source.url,
                description: source.description,
              },
            });
          }

          console.log(`[Auto-Seed] ${webSources.length}件のWebSourceをシードしました`);
        } else {
          console.log("[Auto-Seed] WebSourceシードファイルが見つかりません:", webSourceSeedPath);
        }
      } else {
        console.log(`[Auto-Seed] WebSourceが${webSourceCount}件存在します。シードをスキップします`);
      }

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
                id: doc.id || crypto.randomUUID(),
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
      // 進化生成に必要なデータ（TopStrategy, StrategyDecision）がない場合もシード
      const [explorationCount, topStrategyCount, strategyDecisionCount] = await Promise.all([
        prisma.exploration.count(),
        prisma.topStrategy.count(),
        prisma.strategyDecision.count(),
      ]);

      const needsExplorationSeed = explorationCount === 0 || topStrategyCount === 0 || strategyDecisionCount === 0;

      if (needsExplorationSeed) {
        console.log(`[Auto-Seed] 探索データが不足しています (Exploration: ${explorationCount}, TopStrategy: ${topStrategyCount}, StrategyDecision: ${strategyDecisionCount})。シードを実行します...`);

        // 既存データがある場合は削除してからシード（データの整合性を保つため）
        if (explorationCount > 0 || topStrategyCount > 0 || strategyDecisionCount > 0) {
          console.log("[Auto-Seed] 既存の不完全なデータを削除します...");
          await prisma.strategyDecision.deleteMany();
          await prisma.topStrategy.deleteMany();
          await prisma.exploration.deleteMany();
          await prisma.learningMemory.deleteMany();
          await prisma.companyProfile.deleteMany();
          await prisma.defaultSwot.deleteMany();
          await prisma.coreAsset.deleteMany();
          await prisma.coreService.deleteMany();
        }

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
                    id: asset.id || crypto.randomUUID(),
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
                    id: service.id || crypto.randomUUID(),
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
        console.log(`[Auto-Seed] 探索データが揃っています (Exploration: ${explorationCount}, TopStrategy: ${topStrategyCount}, StrategyDecision: ${strategyDecisionCount})。シードをスキップします`);
      }

      // DrafterTemplateのシード
      const drafterTemplateCount = await prisma.drafterTemplate.count({
        where: { drafterId: "minutes" },
      });

      if (drafterTemplateCount === 0) {
        console.log("[Auto-Seed] 議事録テンプレートが0件です。シードを実行します...");

        await prisma.drafterTemplate.create({
          data: {
            id: crypto.randomUUID(),
            drafterId: "minutes",
            name: "サンプル議事録テンプレート_001.md",
            isDefault: true,
            content: `# 議事録

## 会議情報
- **日時**: YYYY年MM月DD日（曜日） HH:MM〜HH:MM
- **場所**:
- **出席者**:

## 議題
1.
2.
3.

## 議事内容

### 1. 議題1
- 説明:
- 議論:
- 決定事項:

### 2. 議題2
- 説明:
- 議論:
- 決定事項:

## 決定事項まとめ
| No | 決定事項 | 担当者 | 期限 |
|----|----------|--------|------|
| 1 | | | |
| 2 | | | |

## 今後のアクション
| No | アクション | 担当者 | 期限 | 状況 |
|----|------------|--------|------|------|
| 1 | | | | 未着手 |
| 2 | | | | 未着手 |
| 3 | | | | 未着手 |

## 次回予定
- 日時:
- 議題:

## 参考資料
-

## 備考

`,
          },
        });

        console.log("[Auto-Seed] 議事録サンプルテンプレートをシードしました");
      } else {
        console.log(`[Auto-Seed] 議事録テンプレートが${drafterTemplateCount}件存在します。シードをスキップします`);
      }

    } catch (error) {
      console.error("[Auto-Seed] エラー:", error);
    } finally {
      // ingestディレクトリからの自動インジェスト
      // シードの成否に関わらず必ず起動する
      void import("@/lib/auto-ingest").then(async ({ syncWithManifest, startIngestWatcher, ingestOreNaviDocuments }) => {
        // AI構造化変換を先に実行
        try {
          const { refineAllFiles } = await import("@/lib/rag-refiner");
          await refineAllFiles();
        } catch (refineErr) {
          console.error("[RAG Refiner] 初回変換エラー（同期は続行）:", refineErr);
        }

        await syncWithManifest().catch((err) => console.error("[Auto-Ingest] 初回同期エラー:", err));
        await ingestOreNaviDocuments().catch((err) => console.error("[OreNavi-Ingest] 初回インジェストエラー:", err));
        startIngestWatcher();

        // 整合性チェック: 60秒後に初回実行、以降30分間隔
        setTimeout(async () => {
          try {
            const { runIntegrityCheck } = await import("@/lib/rag-integrity");
            await runIntegrityCheck();
            setInterval(async () => {
              try {
                await runIntegrityCheck();
              } catch (err) {
                console.error("[RAG Integrity] 定期チェックエラー:", err);
              }
            }, 30 * 60 * 1000);
          } catch (err) {
            console.error("[RAG Integrity] 初回チェックエラー:", err);
          }
        }, 60 * 1000);

        // チャンクがなければ全ドキュメントを一括チャンク処理
        try {
          const { prisma: db } = await import("@/lib/db");
          const chunkCount = await db.rAGChunk.count();
          if (chunkCount === 0) {
            console.log("[Auto-Seed] RAGチャンクが0件です。全ドキュメントをチャンク処理します...");
            const { processAllDocuments } = await import("@/lib/rag-ingest-pipeline");
            processAllDocuments().catch((err) => console.error("[Auto-Seed] チャンク一括処理エラー:", err));
          } else {
            console.log(`[Auto-Seed] RAGチャンクが${chunkCount}件存在します。チャンク処理をスキップします`);
          }
        } catch (chunkErr) {
          console.error("[Auto-Seed] チャンク処理の初期化エラー（スキップ）:", chunkErr);
        }
      });

      // 中断されたメタファインダーバッチを再開
      void import("@/app/api/meta-finder/batch/route").then(({ resumeRunningBatches }) => {
        resumeRunningBatches().catch((err) => console.error("[MetaFinder] バッチ再開エラー:", err));
      });

      // Webクローラー月次スケジューラーを起動
      void import("@/lib/web-crawler").then(({ startWebCrawlScheduler }) => {
        startWebCrawlScheduler().catch((err) => console.error("[WebCrawler] スケジューラー起動エラー:", err));
      });
    }
  }
}
