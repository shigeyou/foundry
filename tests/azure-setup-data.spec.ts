import { test, expect } from '@playwright/test';

/**
 * Azure版 共通データ作成テスト
 *
 * 会社情報とSWOTデータを作成して永続化テストの準備をします。
 * このデータは削除せず、そのまま保持されます。
 */

test.describe('Azure版 共通データ作成', () => {
  test.describe.configure({ mode: 'serial' });

  test('1. 会社情報（CompanyProfile）を作成', async ({ page }) => {
    console.log('=== 会社情報作成 ===');

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const result = await page.evaluate(async () => {
      const companyData = {
        name: '商船三井マリテックス株式会社',
        shortName: 'マリテックス',
        description: '商船三井グループの船舶管理・技術サービス会社。海運業界で培った技術力とノウハウを活かし、船舶管理、船員配乗、技術コンサルティングなど幅広いサービスを提供。',
        background: '2023年に商船三井の子会社として設立。グループの船舶管理機能を集約し、高品質な船舶管理サービスを提供。',
        techStack: '船舶管理システム、IoTセンサー、予知保全AI、デジタルツイン技術',
        parentCompany: '株式会社商船三井',
        parentRelation: '100%子会社。グループ内の船舶管理・技術サービスを担当。親会社の保有船舶およびグループ外顧客への管理サービスを提供。',
        industry: '海運・船舶管理',
        additionalContext: '脱炭素化、DX推進、人材育成を重点戦略として掲げる。LNG燃料船、アンモニア燃料船など次世代燃料船の管理実績あり。',
      };

      try {
        const response = await fetch('/api/company-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(companyData),
        });

        const data = await response.json();
        return {
          status: response.status,
          ok: response.ok,
          data,
        };
      } catch (error) {
        return { status: 0, ok: false, error: String(error) };
      }
    });

    console.log('会社情報作成結果:', result.status);
    if (result.ok && result.data?.profile) {
      console.log('✅ 会社名:', result.data.profile.name);
      console.log('✅ 略称:', result.data.profile.shortName);
      console.log('✅ 業界:', result.data.profile.industry);
    } else {
      console.log('❌ エラー:', result.data?.error || result.error);
    }

    expect(result.ok).toBe(true);
    expect(result.data?.profile?.name).toBe('商船三井マリテックス株式会社');
  });

  test('2. SWOT分析を作成', async ({ page }) => {
    console.log('=== SWOT分析作成 ===');

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const result = await page.evaluate(async () => {
      const swotData = {
        strengths: [
          '商船三井グループのブランド力と信頼性',
          '長年の海運業界での技術蓄積とノウハウ',
          '多様な船種に対応できる船舶管理能力',
          'LNG船・アンモニア船など次世代燃料船の管理実績',
          '高度な安全管理体制と品質管理システム',
          '優秀な船員の確保・育成ネットワーク',
        ],
        weaknesses: [
          'グループ外顧客への営業力・認知度',
          'DX・デジタル化の遅れ（業界全体の課題）',
          '船員の高齢化と若手人材の確保',
          '親会社依存の収益構造',
          '海外拠点の展開が限定的',
        ],
        opportunities: [
          '脱炭素化に伴う次世代燃料船需要の増加',
          '海運業界のDX化・IoT活用の進展',
          '船舶管理アウトソーシング市場の拡大',
          'アジア・中東での船舶需要の増加',
          '自動運航船・スマートシップ技術の発展',
          '環境規制強化による高度船舶管理の需要増',
        ],
        threats: [
          '海運市況の変動による収益影響',
          '燃料費高騰・環境規制コスト',
          '競合他社の技術革新',
          '船員不足の深刻化',
          '地政学リスク（紛争、海賊等）',
          'サイバーセキュリティリスクの増大',
        ],
        summary: '商船三井グループの技術力と信頼性を強みに、脱炭素化・DX化という市場変化を成長機会として捉える。人材確保とデジタル化が課題であり、次世代船舶管理のリーディングカンパニーを目指す戦略が有効。',
        updatedBy: 'Claude Code（自動設定）',
      };

      try {
        const response = await fetch('/api/admin/swot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(swotData),
        });

        const data = await response.json();
        return {
          status: response.status,
          ok: response.ok,
          data,
        };
      } catch (error) {
        return { status: 0, ok: false, error: String(error) };
      }
    });

    console.log('SWOT作成結果:', result.status);
    if (result.ok && result.data?.swot) {
      console.log('✅ 強み:', result.data.swot.strengths?.length, '件');
      console.log('✅ 弱み:', result.data.swot.weaknesses?.length, '件');
      console.log('✅ 機会:', result.data.swot.opportunities?.length, '件');
      console.log('✅ 脅威:', result.data.swot.threats?.length, '件');
      console.log('✅ サマリー:', result.data.swot.summary?.substring(0, 50) + '...');
    } else {
      console.log('❌ エラー:', result.data?.error || result.error);
    }

    expect(result.ok).toBe(true);
    expect(result.data?.swot?.strengths?.length).toBeGreaterThan(0);
  });

  test('3. 作成したデータを確認', async ({ page }) => {
    console.log('=== データ確認 ===');

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const result = await page.evaluate(async () => {
      // 会社情報を確認
      const companyRes = await fetch('/api/company-profile');
      const companyData = companyRes.ok ? await companyRes.json() : null;

      // SWOT情報を確認
      const swotRes = await fetch('/api/admin/swot');
      const swotData = swotRes.ok ? await swotRes.json() : null;

      // seed APIでカウント確認
      const seedRes = await fetch('/api/seed');
      const seedData = seedRes.ok ? await seedRes.json() : null;

      return {
        company: companyData,
        swot: swotData,
        counts: seedData,
      };
    });

    console.log('\n========================================');
    console.log('作成データ確認結果');
    console.log('========================================');

    console.log('\n【会社情報】');
    if (result.company?.profile) {
      console.log('✅ 会社名:', result.company.profile.name);
      console.log('✅ 業界:', result.company.profile.industry);
      console.log('✅ 設定済み:', result.company.isConfigured);
    } else {
      console.log('❌ 会社情報未設定');
    }

    console.log('\n【SWOT分析】');
    if (result.swot?.swot) {
      console.log('✅ 強み:', result.swot.swot.strengths?.length, '件');
      console.log('✅ 弱み:', result.swot.swot.weaknesses?.length, '件');
      console.log('✅ 機会:', result.swot.swot.opportunities?.length, '件');
      console.log('✅ 脅威:', result.swot.swot.threats?.length, '件');
    } else {
      console.log('❌ SWOT未設定');
    }

    console.log('\n【データカウント】');
    if (result.counts) {
      console.log('  RAGドキュメント:', result.counts.ragDocumentCount);
      console.log('  会社プロファイル:', result.counts.companyProfileCount);
      console.log('  デフォルトSWOT:', result.counts.defaultSwotCount);
      console.log('  探索:', result.counts.explorationCount);
      console.log('  トップ戦略:', result.counts.topStrategyCount);
      console.log('  戦略決定:', result.counts.strategyDecisionCount);
    }

    console.log('========================================\n');

    expect(result.company?.isConfigured).toBe(true);
    expect(result.swot?.exists).toBe(true);
  });
});
