// 各ファインダーの設定（スコア項目、プリセット質問など）

export interface ScoreConfig {
  key: string;
  label: string;
  description: string;
  defaultWeight: number;
}

export interface PresetQuestion {
  label: string;
  question: string;
}

export interface FinderSettings {
  id: string;
  name: string;
  description: string;
  scoreConfig: ScoreConfig[];
  presetQuestions: PresetQuestion[];
  introDescription: string;
  exploreLabel: string; // 「勝ち筋探索」「DX施策探索」など
  resultLabel: string;  // 「勝ち筋」「DX施策」など
  departmentBadgeEnabled?: boolean; // tags[0]を事業部バッジとして表示
  departmentBadgeLabel?: string;    // バッジのラベル（例: "配属先"）
  fixedBadge?: string;              // 全結果に表示する固定バッジ（例: "フィジカルAI"）
}

// ===== 勝ち筋ファインダー =====
const winningStrategyConfig: FinderSettings = {
  id: "winning-strategy",
  name: "勝ち筋ファインダー",
  description: "AIの力を借りて企業の「勝ち筋」を探索するツール",
  exploreLabel: "勝ち筋探索",
  resultLabel: "勝ち筋",
  introDescription: `勝ち筋ファインダーは、AIの力を借りて企業の「勝ち筋」を探索するツールです。
外部データを検索・参照するRAG（Retrieval-Augmented Generation）の仕組みと、
大規模言語モデル（LLM）が保持する広範な知識を組み合わせることで、
自社の強みを活かした戦略オプションを多角的に提案します。`,
  scoreConfig: [
    { key: "revenuePotential", label: "収益ポテンシャル", description: "期待される収益規模", defaultWeight: 30 },
    { key: "timeToRevenue", label: "収益化までの距離", description: "収益化までの期間", defaultWeight: 20 },
    { key: "competitiveAdvantage", label: "勝ち筋の強さ", description: "競争優位性の程度", defaultWeight: 20 },
    { key: "executionFeasibility", label: "実行可能性", description: "実現のしやすさ", defaultWeight: 15 },
    { key: "hqContribution", label: "本社貢献", description: "グループ全体への貢献", defaultWeight: 10 },
    { key: "mergerSynergy", label: "合併シナジー", description: "統合効果の大きさ", defaultWeight: 5 },
  ],
  presetQuestions: [
    // === AI・生成AI系 ===
    { label: "生成AI", question: "生成AIで業務効率化・新サービス創出するには？" },
    { label: "AIエージェント", question: "AIエージェントで複雑な業務を自動化するアプリを作るには？" },
    { label: "RAG構築", question: "社内ナレッジをRAG化して、誰でもAIに質問できる環境を作るには？" },
    { label: "Claude/GPT", question: "Claude/GPTを業務に組み込んだ内製アプリを開発するには？" },
    // === 自動化・システム系 ===
    { label: "社内DX", question: "会社でDXを推進したいと考えています。社内の自動化・効率化を進められる仕組みを作りたいです。まずは、最もインパクトの大きいアプリ案を提案してください。" },
    { label: "自動化", question: "業務自動化（RPA・AI）で人的リソースを最適化するには？" },
    { label: "ワークフロー", question: "承認ワークフローを自動化して意思決定速度を上げるには？" },
    { label: "API連携", question: "複数システムをAPI連携させてデータの二重入力をなくすには？" },
    // === ドローン・IoT・先端技術系 ===
    { label: "ドローン", question: "ドローン技術を活用した新サービス・業務効率化を実現するには？" },
    { label: "IoTセンサー", question: "IoTセンサーでリアルタイム監視・予知保全を実現するには？" },
    { label: "エッジAI", question: "エッジAIで現場判断を自動化・高速化するには？" },
    { label: "デジタルツイン", question: "デジタルツイン技術を活用して業務効率化・予測保全を実現するには？" },
    // === データ・分析系 ===
    { label: "データ分析", question: "データ分析で意思決定の質を向上させるには？" },
    { label: "ダッシュボード", question: "経営ダッシュボードでリアルタイムにKPIを可視化するには？" },
    { label: "予測モデル", question: "需要予測モデルで在庫コスト・機会損失を最小化するには？" },
    // === 組織・プロセス最適化系 ===
    { label: "会議削減", question: "会議時間を半減させながら意思決定品質を維持するには？" },
    { label: "非同期化", question: "同期コミュニケーションを減らし、深い集中時間を確保するには？" },
    { label: "属人化解消", question: "ベテランの暗黙知をシステム化して属人化を解消するには？" },
    { label: "破滅回避", question: "致命的な失敗を防ぐためのフェイルセーフ設計をどう組み込むか？" },
    // === 事業・収益系 ===
    { label: "親会社支援", question: "親会社グループへの貢献価値を高めるには？" },
    { label: "新規事業", question: "既存の強みを活かした新規事業は何か？" },
    { label: "サブスク", question: "サブスクリプション型収益モデルを導入するには？" },
    { label: "横展開", question: "成功した社内システムを他社・グループ会社に横展開するには？" },
    { label: "E2E提供", question: "E2E（エンド・ツー・エンド）サービスで顧客価値を最大化するには？" },
    // === 人材・組織系 ===
    { label: "専門人材", question: "エンジニア・専門人材の採用競争に勝つには？" },
    { label: "人材育成", question: "人材育成・技術継承で差別化するには？" },
    { label: "内製化", question: "IT内製化で外注コストを削減しながら開発速度を上げるには？" },
    // === インフラ・セキュリティ系 ===
    { label: "Azure活用", question: "Azure環境を最大限活用してコスト効率の良いシステムを構築するには？" },
    { label: "セキュリティ", question: "サイバーセキュリティ対策を強化しながら利便性を損なわないには？" },
    // === その他戦略系 ===
    { label: "脱炭素", question: "脱炭素化支援で新たな収益源を作るには？" },
  ],
};

// ===== 自社開発AIアプリファインダー =====
const defensiveDxConfig: FinderSettings = {
  id: "defensive-dx",
  name: "自社開発AIアプリファインダー",
  description: "内製開発で実現可能な「守りのDX」施策を発見するツール",
  exploreLabel: "DX施策探索",
  resultLabel: "DX施策",
  fixedBadge: "フィジカルAI",
  introDescription: `自社開発AIアプリファインダーは、内製開発チームで実現可能な「守りのDX」施策を発見するツールです。
業務効率化、コスト削減、リスク低減など、既存業務を強化するDX施策を
RAGとLLMの組み合わせで多角的に提案します。
「攻めのDX」（新規事業創出）ではなく、既存業務の改善に焦点を当てています。`,
  scoreConfig: [
    { key: "costReduction", label: "コスト削減効果", description: "年間コスト削減額の見込み", defaultWeight: 25 },
    { key: "implementationEase", label: "実装容易性", description: "内製チームでの実現しやすさ", defaultWeight: 25 },
    { key: "riskMitigation", label: "リスク低減", description: "業務リスク・障害リスクの軽減度", defaultWeight: 20 },
    { key: "efficiencyGain", label: "業務効率化", description: "工数削減・処理速度向上の程度", defaultWeight: 15 },
    { key: "employeeSatisfaction", label: "従業員満足度", description: "働きやすさへの貢献", defaultWeight: 10 },
    { key: "scalability", label: "スケーラビリティ", description: "他部門・他業務への展開可能性", defaultWeight: 5 },
  ],
  presetQuestions: [
    { label: "ペーパーレス", question: "紙の申請書・帳票をデジタル化するには？" },
    { label: "承認フロー", question: "承認プロセスを効率化・自動化するには？" },
    { label: "データ連携", question: "システム間のデータ連携を改善するには？" },
    { label: "入力自動化", question: "手入力作業を自動化・削減するには？" },
    { label: "レポート自動化", question: "定期レポート作成を自動化するには？" },
    { label: "ナレッジ共有", question: "社内ナレッジを効果的に共有・活用するには？" },
    { label: "セキュリティ", question: "情報セキュリティを強化するには？" },
    { label: "バックアップ", question: "データバックアップ・災害復旧体制を整備するには？" },
    { label: "会議効率化", question: "会議の効率を上げるには？" },
    { label: "コミュニケーション", question: "社内コミュニケーションを改善するには？" },
    { label: "タスク管理", question: "タスク・プロジェクト管理を効率化するには？" },
    { label: "勤怠管理", question: "勤怠管理・労務管理を改善するには？" },
    { label: "経費精算", question: "経費精算プロセスを効率化するには？" },
    { label: "在庫管理", question: "在庫管理・発注業務を最適化するには？" },
    { label: "顧客対応", question: "顧客問い合わせ対応を効率化するには？" },
    { label: "フィジカルAI", question: "ロボット・ドローンなどフィジカルAIを活用した業務効率化・自動化施策を見つけるには？" },
  ],
};

// ===== 人材ファインダー =====
const talentConfig: FinderSettings = {
  id: "talent",
  name: "人材ファインダー",
  description: "採用すべき人材像を明確化するツール",
  exploreLabel: "人材像探索",
  resultLabel: "人材像",
  departmentBadgeEnabled: true,
  departmentBadgeLabel: "配属先",
  introDescription: `人材ファインダーは、組織が採用すべき人材像を明確化するツールです。
事業戦略、組織課題、市場環境などの情報をRAGで参照しながら、
LLMが最適な人材要件を多角的に提案します。
単なるスキルセットだけでなく、組織文化への適合性や将来性も考慮します。`,
  scoreConfig: [
    { key: "skillMatch", label: "スキルマッチ度", description: "必要スキルとの適合度", defaultWeight: 25 },
    { key: "growthPotential", label: "成長可能性", description: "育成による伸びしろ", defaultWeight: 20 },
    { key: "cultureFit", label: "組織適合性", description: "企業文化との相性", defaultWeight: 20 },
    { key: "futureValue", label: "将来性", description: "中長期的な価値創出期待", defaultWeight: 15 },
    { key: "immediateImpact", label: "即戦力度", description: "入社後すぐに貢献できる度合い", defaultWeight: 15 },
    { key: "costEfficiency", label: "コスト効率", description: "採用・育成コスト対効果", defaultWeight: 5 },
  ],
  presetQuestions: [
    { label: "エンジニア", question: "どのようなスキルセットのエンジニアを採用すべきか？" },
    { label: "マネージャー", question: "プロジェクトマネージャーに求める資質は？" },
    { label: "新卒採用", question: "新卒採用で重視すべきポイントは？" },
    { label: "中途採用", question: "中途採用で優先すべき経験・スキルは？" },
    { label: "リーダー候補", question: "次世代リーダー候補に必要な素養は？" },
    { label: "DX人材", question: "DX推進に必要な人材像とは？" },
    { label: "グローバル人材", question: "グローバル展開に必要な人材要件は？" },
    { label: "専門職", question: "高度専門職の採用基準をどう設定すべきか？" },
    { label: "多様性", question: "ダイバーシティを推進するための採用戦略は？" },
    { label: "リモートワーク", question: "リモートワーク環境で活躍できる人材とは？" },
    { label: "イノベーター", question: "イノベーションを生み出せる人材の特徴は？" },
    { label: "育成方針", question: "採用後の育成方針をどう設計すべきか？" },
  ],
};

// ===== 設定マップ =====
export const finderSettingsMap: Record<string, FinderSettings> = {
  "winning-strategy": winningStrategyConfig,
  "defensive-dx": defensiveDxConfig,
  "talent": talentConfig,
};

// デフォルト設定を取得
export function getFinderSettings(finderId: string | null): FinderSettings {
  if (finderId && finderSettingsMap[finderId]) {
    return finderSettingsMap[finderId];
  }
  // デフォルトは勝ち筋ファインダー
  return winningStrategyConfig;
}

// スコアウェイトをオブジェクト形式で取得
export function getDefaultWeights(finderId: string | null): Record<string, number> {
  const settings = getFinderSettings(finderId);
  const weights: Record<string, number> = {};
  settings.scoreConfig.forEach((config) => {
    weights[config.key] = config.defaultWeight;
  });
  return weights;
}

// スコアラベルをオブジェクト形式で取得
export function getScoreLabels(finderId: string | null): Record<string, string> {
  const settings = getFinderSettings(finderId);
  const labels: Record<string, string> = {};
  settings.scoreConfig.forEach((config) => {
    labels[config.key] = config.label;
  });
  return labels;
}
