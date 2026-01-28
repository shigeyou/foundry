import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Azure版 データ永続化テスト
 *
 * このテストは以下を検証します：
 * 1. 全データテーブルの件数を記録
 * 2. 再起動/再デプロイ後にデータが保持されているか確認
 *
 * 使い方：
 * 1. --grep "記録" で現在のデータを記録
 * 2. 再起動/再デプロイ実行
 * 3. --grep "検証" で永続化を確認
 */

const SNAPSHOT_FILE = path.join(__dirname, '../test-results/persistence-snapshot.json');

interface DataSnapshot {
  timestamp: string;
  data: {
    ragDocuments: number;
    companyProfiles: number;
    defaultSwots: number;
    coreAssets: number;
    coreServices: number;
    explorations: number;
    topStrategies: number;
    strategyDecisions: number;
    learningMemories: number;
    userScoreConfigs: number;
  };
  sampleData: {
    latestExplorationQuestion?: string;
    ragDocumentNames?: string[];
    companyName?: string;
  };
}

test.describe('Azure版 データ永続化テスト', () => {
  test.describe.configure({ mode: 'serial' });

  test('1. データ永続化テスト - 記録フェーズ', async ({ page }) => {
    console.log('=== データ永続化テスト: 記録フェーズ ===');

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 全APIからデータを取得
    const snapshot = await page.evaluate(async (): Promise<DataSnapshot> => {
      const timestamp = new Date().toISOString();

      // seed APIから基本カウントを取得
      const seedRes = await fetch('/api/seed');
      const seedData = seedRes.ok ? await seedRes.json() : {};

      // RAG APIからドキュメント情報を取得
      const ragRes = await fetch('/api/rag');
      const ragData = ragRes.ok ? await ragRes.json() : { documents: [] };
      const ragDocumentNames = ragData.documents?.slice(0, 5).map((d: { filename: string }) => d.filename) || [];

      // 会社情報を取得（正しいエンドポイント）
      const companyRes = await fetch('/api/company-profile');
      const companyData = companyRes.ok ? await companyRes.json() : {};
      const companyName = companyData.profile?.name || null;
      const hasCompanyProfile = companyData.isConfigured ? 1 : 0;

      // SWOT情報を取得
      const swotRes = await fetch('/api/admin/swot');
      const swotData = swotRes.ok ? await swotRes.json() : {};
      const hasSwot = swotData.exists ? 1 : 0;

      // 探索履歴から最新の質問を取得
      const historyRes = await fetch('/api/history');
      const historyData = historyRes.ok ? await historyRes.json() : { explorations: [] };
      const latestExplorationQuestion = historyData.explorations?.[0]?.question || null;

      // スコア設定を取得
      const scoreRes = await fetch('/api/score-config');
      const scoreData = scoreRes.ok ? await scoreRes.json() : {};
      const userScoreConfigs = scoreData.config ? 1 : 0;

      return {
        timestamp,
        data: {
          ragDocuments: seedData.ragDocumentCount || ragData.documents?.length || 0,
          companyProfiles: hasCompanyProfile,
          defaultSwots: hasSwot,
          coreAssets: seedData.coreAssetCount || 0,
          coreServices: seedData.coreServiceCount || 0,
          explorations: seedData.explorationCount || 0,
          topStrategies: seedData.topStrategyCount || 0,
          strategyDecisions: seedData.strategyDecisionCount || 0,
          learningMemories: seedData.learningMemoryCount || 0,
          userScoreConfigs,
        },
        sampleData: {
          latestExplorationQuestion,
          ragDocumentNames,
          companyName,
        },
      };
    });

    // 結果を表示
    console.log('\n========================================');
    console.log('データスナップショット（記録時刻:', snapshot.timestamp, ')');
    console.log('========================================');
    console.log('\n【共通データ】');
    console.log('  RAGドキュメント数:', snapshot.data.ragDocuments);
    console.log('  会社プロフィール数:', snapshot.data.companyProfiles);
    console.log('  デフォルトSWOT数:', snapshot.data.defaultSwots);
    console.log('  コアアセット数:', snapshot.data.coreAssets);
    console.log('  コアサービス数:', snapshot.data.coreServices);
    console.log('\n【個人データ】');
    console.log('  探索数:', snapshot.data.explorations);
    console.log('  トップ戦略数:', snapshot.data.topStrategies);
    console.log('  戦略決定数:', snapshot.data.strategyDecisions);
    console.log('  学習メモリ数:', snapshot.data.learningMemories);
    console.log('  スコア設定数:', snapshot.data.userScoreConfigs);
    console.log('\n【サンプルデータ】');
    console.log('  会社名:', snapshot.sampleData.companyName || '(未設定)');
    console.log('  最新探索質問:', snapshot.sampleData.latestExplorationQuestion || '(なし)');
    console.log('  RAGドキュメント:', snapshot.sampleData.ragDocumentNames?.join(', ') || '(なし)');
    console.log('========================================\n');

    // スナップショットをファイルに保存
    const dir = path.dirname(SNAPSHOT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2));
    console.log('スナップショット保存先:', SNAPSHOT_FILE);

    // 基本的な検証
    expect(snapshot.data.ragDocuments).toBeGreaterThanOrEqual(0);
    expect(snapshot.timestamp).toBeTruthy();
  });

  test('2. データ永続化テスト - 検証フェーズ', async ({ page }) => {
    console.log('=== データ永続化テスト: 検証フェーズ ===');

    // 保存されたスナップショットを読み込み
    if (!fs.existsSync(SNAPSHOT_FILE)) {
      console.error('スナップショットファイルが見つかりません。先に記録フェーズを実行してください。');
      console.error('コマンド: npx playwright test --config=playwright.azure.config.ts --grep "記録"');
      throw new Error('スナップショットファイルが存在しません: ' + SNAPSHOT_FILE);
    }

    const previousSnapshot: DataSnapshot = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf-8'));
    console.log('前回記録時刻:', previousSnapshot.timestamp);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 現在のデータを取得
    const currentData = await page.evaluate(async () => {
      const seedRes = await fetch('/api/seed');
      const seedData = seedRes.ok ? await seedRes.json() : {};

      const ragRes = await fetch('/api/rag');
      const ragData = ragRes.ok ? await ragRes.json() : { documents: [] };
      const ragDocumentNames = ragData.documents?.slice(0, 5).map((d: { filename: string }) => d.filename) || [];

      // 会社情報を取得（正しいエンドポイント）
      const companyRes = await fetch('/api/company-profile');
      const companyData = companyRes.ok ? await companyRes.json() : {};
      const companyName = companyData.profile?.name || null;
      const hasCompanyProfile = companyData.isConfigured ? 1 : 0;

      // SWOT情報を取得
      const swotRes = await fetch('/api/admin/swot');
      const swotData = swotRes.ok ? await swotRes.json() : {};
      const hasSwot = swotData.exists ? 1 : 0;

      const historyRes = await fetch('/api/history');
      const historyData = historyRes.ok ? await historyRes.json() : { explorations: [] };

      const scoreRes = await fetch('/api/score-config');
      const scoreData = scoreRes.ok ? await scoreRes.json() : {};

      return {
        data: {
          ragDocuments: seedData.ragDocumentCount || ragData.documents?.length || 0,
          companyProfiles: hasCompanyProfile,
          defaultSwots: hasSwot,
          coreAssets: seedData.coreAssetCount || 0,
          coreServices: seedData.coreServiceCount || 0,
          explorations: seedData.explorationCount || 0,
          topStrategies: seedData.topStrategyCount || 0,
          strategyDecisions: seedData.strategyDecisionCount || 0,
          learningMemories: seedData.learningMemoryCount || 0,
          userScoreConfigs: scoreData.config ? 1 : 0,
        },
        sampleData: {
          latestExplorationQuestion: historyData.explorations?.[0]?.question || null,
          ragDocumentNames,
          companyName,
        },
      };
    });

    // 比較結果を表示
    console.log('\n========================================');
    console.log('データ永続化検証結果');
    console.log('========================================');

    const prev = previousSnapshot.data;
    const curr = currentData.data;

    let allPassed = true;

    const checkField = (name: string, prevVal: number, currVal: number) => {
      const status = currVal >= prevVal ? '✅' : '❌';
      const diff = currVal - prevVal;
      const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;
      console.log(`${status} ${name}: ${prevVal} → ${currVal} (${diffStr})`);
      if (currVal < prevVal) allPassed = false;
      return currVal >= prevVal;
    };

    console.log('\n【共通データ】');
    checkField('RAGドキュメント', prev.ragDocuments, curr.ragDocuments);
    checkField('会社プロフィール', prev.companyProfiles, curr.companyProfiles);
    checkField('デフォルトSWOT', prev.defaultSwots, curr.defaultSwots);
    checkField('コアアセット', prev.coreAssets, curr.coreAssets);
    checkField('コアサービス', prev.coreServices, curr.coreServices);

    console.log('\n【個人データ】');
    checkField('探索', prev.explorations, curr.explorations);
    checkField('トップ戦略', prev.topStrategies, curr.topStrategies);
    checkField('戦略決定', prev.strategyDecisions, curr.strategyDecisions);
    checkField('学習メモリ', prev.learningMemories, curr.learningMemories);
    checkField('スコア設定', prev.userScoreConfigs, curr.userScoreConfigs);

    console.log('\n【サンプルデータ検証】');
    if (previousSnapshot.sampleData.companyName) {
      const companyMatch = currentData.sampleData.companyName === previousSnapshot.sampleData.companyName;
      console.log(`${companyMatch ? '✅' : '❌'} 会社名: "${previousSnapshot.sampleData.companyName}" → "${currentData.sampleData.companyName}"`);
      if (!companyMatch) allPassed = false;
    }

    if (previousSnapshot.sampleData.latestExplorationQuestion) {
      const questionMatch = currentData.sampleData.latestExplorationQuestion === previousSnapshot.sampleData.latestExplorationQuestion;
      console.log(`${questionMatch ? '✅' : '❌'} 最新探索質問保持`);
      if (!questionMatch) allPassed = false;
    }

    console.log('\n========================================');
    console.log(allPassed ? '✅ 全データ永続化: 成功' : '❌ 一部データ損失あり');
    console.log('========================================\n');

    // アサーション
    expect(curr.ragDocuments).toBeGreaterThanOrEqual(prev.ragDocuments);
    expect(curr.explorations).toBeGreaterThanOrEqual(prev.explorations);
    expect(curr.topStrategies).toBeGreaterThanOrEqual(prev.topStrategies);
    expect(curr.strategyDecisions).toBeGreaterThanOrEqual(prev.strategyDecisions);

    if (previousSnapshot.sampleData.companyName) {
      expect(currentData.sampleData.companyName).toBe(previousSnapshot.sampleData.companyName);
    }
  });

  test('3. 全データ一括検証（再起動前後で実行）', async ({ page }) => {
    console.log('=== 全データ一括検証 ===');

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // 全APIエンドポイントをテスト
    const results = await page.evaluate(async () => {
      const endpoints = [
        { name: 'seed (データカウント)', url: '/api/seed', method: 'GET' },
        { name: 'rag (RAGドキュメント)', url: '/api/rag', method: 'GET' },
        { name: 'company (会社情報)', url: '/api/company', method: 'GET' },
        { name: 'swot (SWOT分析)', url: '/api/swot', method: 'GET' },
        { name: 'history (探索履歴)', url: '/api/history', method: 'GET' },
        { name: 'ranking (ランキング)', url: '/api/ranking', method: 'GET' },
        { name: 'score-config (スコア設定)', url: '/api/score-config', method: 'GET' },
        { name: 'learning (学習メモリ)', url: '/api/learning', method: 'GET' },
      ];

      const results: Array<{ name: string; status: number; ok: boolean; dataCount?: number; error?: string }> = [];

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep.url);
          let dataCount: number | undefined;

          if (res.ok) {
            const data = await res.json();
            // データ件数を推定
            if (Array.isArray(data)) {
              dataCount = data.length;
            } else if (data.documents) {
              dataCount = data.documents.length;
            } else if (data.explorations) {
              dataCount = data.explorations.length;
            } else if (data.strategies) {
              dataCount = data.strategies.length;
            } else if (data.patterns) {
              dataCount = data.patterns.length;
            }
          }

          results.push({
            name: ep.name,
            status: res.status,
            ok: res.ok,
            dataCount,
          });
        } catch (error) {
          results.push({
            name: ep.name,
            status: 0,
            ok: false,
            error: String(error),
          });
        }
      }

      return results;
    });

    console.log('\n========================================');
    console.log('APIエンドポイント検証結果');
    console.log('========================================\n');

    let allOk = true;
    for (const r of results) {
      const status = r.ok ? '✅' : '❌';
      const countStr = r.dataCount !== undefined ? ` (${r.dataCount}件)` : '';
      console.log(`${status} ${r.name}: ${r.status}${countStr}`);
      if (!r.ok) allOk = false;
    }

    console.log('\n========================================');
    console.log(allOk ? '✅ 全API正常' : '⚠️ 一部APIエラーあり');
    console.log('========================================\n');

    // 主要APIは成功すること
    const seedResult = results.find(r => r.name.includes('seed'));
    expect(seedResult?.ok).toBe(true);
  });
});
