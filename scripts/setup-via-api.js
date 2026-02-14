// Setup real data via API calls

const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('=== クリーンアップ開始 ===');

  // 1. Get all services and delete them
  const servicesRes = await fetch(`${BASE_URL}/api/core/services`);
  const services = await servicesRes.json();

  if (Array.isArray(services)) {
    for (const service of services) {
      await fetch(`${BASE_URL}/api/core/services?id=${service.id}`, { method: 'DELETE' });
    }
    console.log(`削除したサービス: ${services.length}件`);
  }

  // 2. Get all assets and delete them
  const assetsRes = await fetch(`${BASE_URL}/api/core/assets`);
  const assets = await assetsRes.json();

  if (Array.isArray(assets)) {
    for (const asset of assets) {
      await fetch(`${BASE_URL}/api/core/assets?id=${asset.id}`, { method: 'DELETE' });
    }
    console.log(`削除した資産: ${assets.length}件`);
  }

  console.log('\n=== 実サービスを登録 ===');

  // MOL Maritexの実サービス
  const newServices = [
    {
      name: '海技訓練サービス',
      category: '人材育成',
      description: '操船シミュレータ、DPトレーニング（ClassNK認証）、BRM訓練、当直訓練を提供',
    },
    {
      name: '新造船建造監理',
      category: '技術・エンジニアリング',
      description: '新造船の設計審査、建造監督、検査立会い、品質管理を実施',
    },
    {
      name: '船舶管理・運航支援',
      category: '運航管理',
      description: '船隊運営、安全管理、乗組員配乗、燃料最適化、保守計画策定',
    },
    {
      name: '海事コンサルティング',
      category: 'コンサルティング',
      description: '海事規制対応、IMO規則準拠支援、脱炭素戦略立案、技術評価',
    },
    {
      name: '観測・調査支援サービス',
      category: '技術・エンジニアリング',
      description: '海洋観測船の運航支援、調査データ管理、研究機関との連携',
    },
    {
      name: 'ケーブル船運航管理',
      category: '運航管理',
      description: '通信・電力ケーブル敷設船の運航、工事計画調整、気象海象管理',
    },
    {
      name: '洋上風力O&M支援',
      category: '技術・エンジニアリング',
      description: '洋上風力発電所の運転保守支援、CTV/SOV運航、要員派遣',
    },
  ];

  for (const service of newServices) {
    const res = await fetch(`${BASE_URL}/api/core/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(service),
    });
    if (res.ok) {
      console.log(`  + ${service.name}`);
    } else {
      console.log(`  ! ${service.name} - 失敗`);
    }
  }

  console.log('\n=== 実資産を登録 ===');

  // MOL Maritexの実資産 (type フィールドを使用)
  const newAssets = [
    {
      name: 'DPトレーニングセンター',
      type: '訓練設備',
      description: 'ClassNK認証取得のDP訓練施設。シミュレータ4基、年間500名以上の訓練実績',
    },
    {
      name: '操船シミュレータ設備',
      type: '訓練設備',
      description: 'フルミッションブリッジシミュレータ2基、パートタスクシミュレータ6基',
    },
    {
      name: '海事専門知識ベース',
      type: 'ナレッジ',
      description: 'IMO規則、旗国要件、P&I保険、船級規則、入出港手続等の専門知識DB',
    },
    {
      name: '船員ネットワーク',
      type: '人的資産',
      description: '訓練修了者2,000名以上、DP有資格者ネットワーク、フィリピン商船大学連携',
    },
    {
      name: 'MOLグループ顧客基盤',
      type: '関係資産',
      description: '親会社MOLおよびグループ各社との業務連携、船隊400隻へのアクセス',
    },
    {
      name: 'Azure AI基盤',
      type: 'IT基盤',
      description: 'Azure OpenAI Service、Azure Cognitive Services、セキュアなAI実行環境',
    },
  ];

  for (const asset of newAssets) {
    const res = await fetch(`${BASE_URL}/api/core/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asset),
    });
    if (res.ok) {
      console.log(`  + ${asset.name}`);
    } else {
      const error = await res.json();
      console.log(`  ! ${asset.name} - 失敗: ${error.error}`);
    }
  }

  console.log('\n=== SWOT更新 ===');

  // SWOTを更新
  const swotData = {
    strengths: [
      'ClassNK認証DPトレーニングセンター保有',
      '操船シミュレータ・海技訓練の実績',
      '新造船建造監理の技術力',
      '海事規制・手続の専門知識',
      'MOLグループの信用力・顧客基盤',
      'Azure AI基盤の整備',
    ],
    weaknesses: [
      'AI/デジタル人材の不足',
      '外部顧客向けブランド認知度',
      'SaaS型ビジネスの経験不足',
      '営業組織の規模',
    ],
    opportunities: [
      '洋上風力市場の急成長（DP要員需要増）',
      '生成AI活用による業務効率化ニーズ',
      '脱炭素規制強化（CII、EU-ETS等）',
      '船員不足に伴う訓練・育成ニーズ',
      'ケーブル船需要増（データセンター、再エネ）',
    ],
    threats: [
      '大手船級協会のAI参入',
      'IT企業の海事分野進出',
      'DP有資格者の獲得競争激化',
      '親会社のコスト削減圧力',
    ],
    summary: 'ClassNK認証DPトレーニングと海事専門知識を強みに、洋上風力・脱炭素需要を取り込む。生成AIで訓練・コンサル業務を高度化し、グループ外への展開を図る。人材確保と競合対策が課題。',
  };

  const swotRes = await fetch(`${BASE_URL}/api/admin/swot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(swotData),
  });

  if (swotRes.ok) {
    console.log('SWOT更新完了');
  } else {
    console.log('SWOT更新失敗');
  }

  console.log('\n=== 確認 ===');

  // 確認
  const checkServices = await fetch(`${BASE_URL}/api/core/services`);
  const checkServicesData = await checkServices.json();
  console.log(`サービス: ${Array.isArray(checkServicesData) ? checkServicesData.length : 0}件`);

  const checkAssets = await fetch(`${BASE_URL}/api/core/assets`);
  const checkAssetsData = await checkAssets.json();
  console.log(`資産: ${Array.isArray(checkAssetsData) ? checkAssetsData.length : 0}件`);

  const checkSwot = await fetch(`${BASE_URL}/api/admin/swot`);
  const checkSwotData = await checkSwot.json();
  console.log(`SWOT: ${checkSwotData.exists ? '設定済み' : '未設定'}`);

  console.log('\n=== 完了 ===');
}

main().catch(console.error);
