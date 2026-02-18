"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { HomeButton } from "@/components/ui/home-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { exportMetaFinderPdf } from "@/lib/export-pdf";

interface DiscoveredIdea {
  id: string;
  name: string;
  description: string;
  reason: string;
  // BSC 4視点スコア
  financial: number;
  customer: number;
  process: number;
  growth: number;
}

interface MetaFinderResult {
  ideas: DiscoveredIdea[];
  thinkingProcess: string;
  summary: string;
}

// バッチ関連のインターフェース
interface BatchInfo {
  id: string;
  status: string;
  totalPatterns: number;
  completedPatterns: number;
  totalIdeas: number;
  currentTheme?: string;
  currentDept?: string;
  startedAt: string;
  completedAt?: string;
  errors?: string;
}

interface BatchIdea {
  id: string;
  themeId: string;
  themeName: string;
  deptId: string;
  deptName: string;
  name: string;
  description: string;
  actions: string | null;
  reason: string;
  // BSC 4視点スコア
  financial: number;
  customer: number;
  process: number;
  growth: number;
  score: number;
}

interface BatchSummary {
  batch: BatchInfo;
  stats: {
    totalIdeas: number;
    avgScore: string;
    // BSC 4視点の平均
    avgFinancial: string;
    avgCustomer: string;
    avgProcess: string;
    avgGrowth: string;
    maxScore: number;
  };
  scoreDistribution: {
    excellent: number;
    good: number;
    average: number;
    low: number;
  };
  topIdeas: BatchIdea[];
  themeBest: BatchIdea[];
  deptBest: BatchIdea[];
}

// カテゴリ定義（大項目）
const themeCategories = [
  { id: "special", label: "特別", color: "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200" },
  { id: "strategy", label: "事業・戦略", color: "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200" },
  { id: "operations", label: "業務・基盤", color: "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200" },
  { id: "people", label: "人・組織", color: "bg-pink-100 dark:bg-pink-900/50 text-pink-800 dark:text-pink-200" },
  { id: "governance", label: "意思決定", color: "bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200" },
  { id: "external", label: "外部・社会", color: "bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200" },
];

// 事業テーマ（行）- 18テーマ
const businessThemes = [
  // 【特別モード】
  { id: "holistic", label: "全部入り（本質探索）", description: "特定の切り口に縛られず、最も本質的なことを探索する", category: "special" },

  // 【A】事業・戦略
  { id: "competitive", label: "競争優位・差別化", description: "他社にない強みをどう築くか、独自のポジショニング", category: "strategy" },
  { id: "innovation", label: "新規事業・イノベーション", description: "新しい価値の創出、事業機会の発見、技術革新", category: "strategy" },
  { id: "portfolio", label: "事業ポートフォリオ・資源配分", description: "何に集中し何を捨てるか、経営資源の最適配分", category: "strategy" },

  // 【B】オペレーション・基盤
  { id: "efficiency", label: "業務効率化・コスト最適化", description: "無駄の削減、プロセス改善、生産性向上", category: "operations" },
  { id: "quality", label: "品質・安全・信頼性", description: "サービス品質、作業安全、顧客からの信頼", category: "operations" },
  { id: "offensive-dx", label: "攻めのDX", description: "デジタル技術による新規事業創出・競争優位性確立・顧客体験向上", category: "operations" },
  { id: "defensive-dx", label: "守りのDX", description: "デジタル技術による業務効率化・コスト削減・リスク低減・既存事業の強靭化", category: "operations" },

  // 【C】人・組織・文化
  { id: "org-design", label: "組織設計・権限委譲", description: "誰が何を決めどう動くか、組織構造と意思決定権限", category: "people" },
  { id: "leadership", label: "リーダーシップ・マネジメント力", description: "管理職の質、部下育成力、チームを導く力", category: "people" },
  { id: "talent", label: "人材獲得・育成・定着", description: "良い人材をどう集め、育て、辞めさせないか", category: "people" },
  { id: "culture", label: "組織文化・心理的安全性", description: "本音が言える風土、失敗から学べる文化、信頼関係", category: "people" },
  { id: "engagement", label: "エンゲージメント・モチベーション", description: "やる気と当事者意識、仕事への没頭、会社への愛着", category: "people" },

  // 【D】意思決定・ガバナンス
  { id: "decision", label: "意思決定の質・スピード", description: "正しく速く決められるか、データに基づく判断", category: "governance" },
  { id: "risk", label: "リスク管理・コンプライアンス", description: "守るべきものを守る、法令遵守、内部統制", category: "governance" },

  // 【E】外部関係・社会
  { id: "customer", label: "顧客価値・関係深化", description: "顧客にとっての存在意義、関係性の強化", category: "external" },
  { id: "partnership", label: "パートナー・エコシステム", description: "外部との協働、アライアンス、共創", category: "external" },
  { id: "sustainability", label: "環境対応・サステナビリティ", description: "GX推進、環境負荷低減、長期的な社会価値", category: "external" },
];

// カテゴリごとにテーマをグループ化
const themesByCategory = themeCategories.map(cat => ({
  ...cat,
  themes: businessThemes.filter(t => t.category === cat.id),
}));

// 部門（列）
const departments = [
  { id: "all", label: "全社", description: "全社共通で活用できる施策" },
  { id: "planning", label: "総合企画部", description: "経営計画・予算編成・事業企画・DX推進企画" },
  { id: "hr", label: "人事総務部", description: "採用・育成・労務・総務・安全衛生" },
  { id: "finance", label: "経理部", description: "決算・予実管理・原価管理・内部統制" },
  { id: "maritime-tech", label: "海洋技術事業部", description: "港湾・係留安全性検討・GXコンサル" },
  { id: "simulator", label: "シミュレータ技術部", description: "シミュレータ維持管理・シナリオ開発" },
  { id: "training", label: "海技訓練事業部", description: "操船・機関・荷役・DP訓練" },
  { id: "cable", label: "ケーブル船事業部", description: "ケーブル船運航・船舶管理" },
  { id: "offshore-training", label: "オフショア船訓練事業部", description: "DPコース・船種別コース運営" },
  { id: "ocean", label: "海洋事業部", description: "研究船運航・観測支援" },
  { id: "wind", label: "洋上風力部", description: "海域調査・O&M支援" },
  { id: "onsite", label: "オンサイト事業部", description: "技術者派遣・艤装支援" },
  { id: "maritime-ops", label: "海事業務部", description: "JG・GC/LC・許認可申請" },
  { id: "newbuild", label: "新造船PM事業本部", description: "建造監理・技術PM・品質工程管理" },
];

// テーマ別の探索視点
const themeAngles: Record<string, string> = {
  // 【特別モード】
  "holistic": `「全部入り」という名前は、逆説的に「何も縛らない」ことを意味します。

コスト削減、売上拡大、リスク管理...といった個別の切り口には、それぞれの限界があります。
その切り口に縛られている限り、見えないものがあるかもしれない。

この探索では、以下の問いに正面から向き合ってください：

**「この部門・この人にとって、今、最も本質的なことは何か？」**

思考のヒント：
- 「やるべきこと」ではなく「やめるべきこと」は何か？
- 10年後に振り返ったとき、今最も重要だったと言えることは何か？
- 表面的な課題の奥にある、本当の問題は何か？
- 誰も言語化できていないが、皆が薄々感じていることは何か？
- 「効率化」や「改善」を超えた、本質的な変化とは何か？

正解は求めていません。
むしろ「正解があるはず」という思い込みを手放し、
この対象に対する深い洞察を得ることが目的です。`,

  // 【A】事業・戦略
  "competitive": `競争優位とは「選ばれる理由」です。
価格で勝負するのか、品質で勝負するのか、スピードで勝負するのか。
あるいは「この会社にしかできないこと」で勝負するのか。

重要なのは「何で戦うか」を明確にし、そこにリソースを集中すること。
すべてで勝とうとすると、どこでも勝てなくなります。

この部門の強み、他社が真似できない資産は何か？
それをどう磨き、どう活かすかを探索してください。`,

  "innovation": `イノベーションは「ゼロから生み出す」だけでなく「既存の掛け合わせ」からも生まれます。
この部門が持つ専門性と、他業界・他部門の知見を組み合わせることで、
まだ誰も見たことのないサービスが生まれる可能性があります。

「失敗しても学びになる」小さな実験を積み重ねられる仕組みも併せて考えてください。
イノベーションの敵は「失敗を許さない文化」です。`,

  "portfolio": `経営資源は有限です。人も、金も、時間も。
だからこそ「何をやるか」より「何をやらないか」の判断が重要になります。

成長事業に投資すべきか、成熟事業を守るべきか。
撤退すべき事業はないか。買収すべき事業はないか。

この部門において「もっと注力すべきこと」と「やめるべきこと」を探索してください。
聖域なく、ゼロベースで考えることが大切です。`,

  // 【B】オペレーション・基盤
  "efficiency": `「本当に必要な作業は何か？」を問い直すところから始めてください。
単なる自動化ではなく、そもそも不要な作業を見つけ出すことが最大のコスト削減です。

「昔からやっているから」「誰かが始めたから」という理由だけで続けている作業はないか？
人がやるべき仕事とシステムに任せるべき仕事の境界線を再定義してください。`,

  "quality": `品質と安全は「当たり前」と思われがちですが、それを維持するコストは決して小さくありません。
問題は、品質維持のための作業が属人化・形骸化していないかということです。

「なぜこの手順が必要なのか」を常に問い直し、本質的な品質向上に集中できる環境を作る。
現場の「気づき」を拾い上げ、組織的な改善につなげる仕組みを考えてください。`,

  "offensive-dx": `攻めのDXとは、デジタル技術を「武器」として使い、競争優位性を築くことです。
重要なのは「他社ができないこと」を見つけること。汎用的な効率化ツールでは差別化になりません。

この部門ならではの専門性、データ、顧客接点を活かし、
「この会社だからこそ提供できる価値」を生み出す施策を大胆に構想してください。`,

  "defensive-dx": `守りのDXは地味に見えますが、経営の根幹を支える重要な取り組みです。
ポイントは「今動いているものを止めない」ことと「将来の変化に備える」ことの両立。

既存業務をデジタル化する際は、単なる電子化ではなく、
業務フロー自体を見直す機会として捉え、「変化に強い仕組み」を設計してください。`,

  // 【C】人・組織・文化
  "org-design": `組織設計の本質は「誰が何を決められるか」を明確にすることです。

権限が集中しすぎると意思決定が遅くなり、分散しすぎると統制が効かなくなる。
現場に任せるべきことと、上が決めるべきことの境界線はどこにあるか？

また、組織の「箱」だけでなく「つながり」も重要です。
部門間の壁を越えて協働できる仕組みがあるか探索してください。`,

  "leadership": `管理職の質が組織の命運を握ります。
優秀なプレイヤーが優秀なマネージャーになるとは限らない。

部下の強みを引き出せているか？成長機会を与えられているか？
適切なフィードバックができているか？心理的安全性を作れているか？

管理職の育成・支援・評価の仕組みに課題はないか探索してください。
「名ばかり管理職」を作らない仕組みが必要です。`,

  "talent": `「良い人が来ない」「良い人が辞める」—これは結果であって原因ではありません。

なぜ来ないのか？—会社の魅力が伝わっていない？報酬が見合わない？成長機会がない？
なぜ辞めるのか？—上司との関係？将来が見えない？仕事がつまらない？評価されない？

採用・育成・評価・配置の一連の流れの中で、どこにボトルネックがあるか。
「この会社で働きたい」「この会社で働き続けたい」と思わせる要素は何かを探索してください。`,

  "culture": `組織文化は「空気」のようなもので、目に見えないが確実に行動に影響を与えます。

本音が言えない空気はないか？失敗を責める文化はないか？
挑戦より保身が優先される風土はないか？上に忖度する習慣はないか？

心理的安全性がなければ、問題は隠され、改善は進まず、イノベーションは生まれません。
「言いたいことが言える」「失敗しても学びに変えられる」組織を作るための施策を探索してください。`,

  "engagement": `エンゲージメントが低い組織では、人は「仕事をこなす」だけになります。
創意工夫は生まれず、問題を見ても見て見ぬふり、改善提案もしなくなる。

エンゲージメントを高めるには：
- 仕事の意味・目的が理解できているか
- 自分の成長を実感できているか
- 貢献が認められ、評価されているか
- 仲間との信頼関係があるか
- 将来の展望が見えているか

これらの観点から、何が欠けているか、どう改善できるかを探索してください。`,

  // 【D】意思決定・ガバナンス
  "decision": `意思決定の質を上げるには、まず「何を決めるべきか」を明確にする必要があります。
データは意思決定を支援しますが、データに意思決定を委ねてはいけません。

選択肢の提示、リスクの可視化、シナリオの比較を通じて、
経営者や現場リーダーが「腹を括る」ための判断材料を提供できる仕組みを考えてください。

また、決めた後の実行とフォローアップも重要です。
「決めっぱなし」になっていないか？振り返りと軌道修正の仕組みはあるか？`,

  "risk": `リスク管理の本質は「想定外をなくすこと」ではなく「想定外に強くなること」です。
完璧な予測は不可能ですが、早期発見・迅速対応・学習改善のサイクルは強化できます。

また、コンプライアンスは「守り」に見えて、実は「攻め」の武器にもなります。
「ルールを守る会社」から「ルールを使いこなす会社」への転換を支援する施策を考えてください。`,

  // 【E】外部関係・社会
  "customer": `顧客対応で最も価値があるのは「問い合わせを減らす」ことではなく「信頼を築く」ことです。

顧客が本当に求めているものは何か？言葉にしていないニーズは何か？
「また頼みたい」と思われる関係を築くには何が必要か？

顧客の声を聴き、分析し、サービス改善につなげる仕組みを探索してください。
顧客との接点を「コスト」ではなく「価値創造の機会」として捉え直すことが重要です。`,

  "partnership": `一社だけでできることには限界があります。
パートナーとの協働、アライアンス、エコシステムの構築が競争力の源泉になる時代です。

どんなパートナーと組むべきか？何を自社でやり、何を外部に委ねるか？
Win-Winの関係をどう構築し、維持するか？

この部門において、外部との連携で生まれる新しい価値を探索してください。`,

  "sustainability": `サステナビリティは「コスト」ではなく「投資」として捉えるべきフェーズに入っています。
環境対応をビジネスチャンスに変える発想が求められます。

CO2削減や資源効率化の取り組みを「見える化」し、顧客や社会への訴求価値に変換する。
長期的な視点で、この部門が社会に提供できる価値は何かを探索してください。`,
};

// 部門別の文脈
const deptContext: Record<string, string> = {
  "all": `全社横断で活用できる施策を構想してください。
部門を超えた情報共有、全社共通の課題解決、組織文化の変革につながるものを優先します。
特定部門でのパイロット運用から始めて、成功事例を横展開する流れも視野に入れてください。`,

  "planning": `総合企画部は会社の羅針盤です。
経営計画の策定、予算編成、事業ポートフォリオの最適化、そしてDX推進の司令塔としての役割を担います。
全社の情報が集まるこの部門だからこそ見える課題、この部門だからこそできる変革があるはずです。`,

  "hr": `人事総務部は「人」に関わるすべての窓口です。
採用・育成・評価・労務管理から、安全衛生、福利厚生まで幅広い業務を担います。
従業員一人ひとりの成長と、組織全体のパフォーマンス向上を両立させる視点で考えてください。`,

  "finance": `経理部は会社の健康状態を数字で表現する部門です。
決算、予実管理、原価管理、内部統制と、正確性と迅速性の両方が求められます。
数字の裏にあるストーリーを読み解き、経営判断に活かせる情報を提供する役割も担います。`,

  "maritime-tech": `海洋技術事業部は、港湾・係留の安全性検討やGXコンサルティングを手がけます。
高度な技術的専門性と、それを分かりやすく伝えるコミュニケーション力の両方が求められます。
技術力を「顧客の安心」に変換するプロセスをAIで強化する可能性を探ってください。`,

  "simulator": `シミュレータ技術部は、訓練用シミュレータの維持管理とシナリオ開発を担います。
リアリティのある訓練環境を提供し、安全な失敗と学びの機会を創出する重要な役割です。
AIを活用して、より効果的な訓練シナリオを生成したり、訓練結果を分析する可能性を考えてください。`,

  "training": `海技訓練事業部は、操船・機関・荷役・DP訓練を提供します。
実践的なスキルを安全に習得させることが使命であり、教育効果の最大化が常に求められます。
訓練生の理解度に応じたカスタマイズや、訓練記録の活用にAIが貢献できる余地があります。`,

  "cable": `ケーブル船事業部は、海底ケーブル敷設船の運航・船舶管理を行います。
特殊な技術と長期間の洋上作業を伴うプロジェクトが多く、計画性と柔軟性の両立が鍵です。
遠隔地からの船舶状況把握や、乗組員のサポートにAIを活用できる可能性を探ってください。`,

  "offshore-training": `オフショア船訓練事業部は、DPコースや船種別コースの運営を担います。
高度な専門性を持つ受講生に対し、実践的かつ効率的な訓練を提供することが求められます。
コース運営の効率化と訓練品質の向上をAIでどう実現できるか考えてください。`,

  "ocean": `海洋事業部は、研究船の運航と観測支援を行います。
科学者や研究機関との協働が多く、正確なデータ収集と柔軟な運航計画が求められます。
研究支援の高度化や、観測データの活用にAIが貢献できる可能性を探ってください。`,

  "wind": `洋上風力部は、成長市場である洋上風力発電の海域調査やO&M支援を手がけます。
新しい市場でのポジション確立と、他社との差別化が重要なフェーズです。
洋上風力特有の課題解決にAIを活用し、競争優位を築く方法を考えてください。`,

  "onsite": `オンサイト事業部は、造船所・船主・海運会社への技術者派遣や艤装支援を行います。
顧客先での信頼構築と、技術者一人ひとりのパフォーマンス向上が事業の根幹です。
派遣技術者のサポートや、顧客との関係強化にAIを活用する可能性を探ってください。`,

  "maritime-ops": `海事業務部は、JG検査対応、GC/LC発給、各種許認可申請など、海事に関わる手続き業務を担います。
専門知識と正確性が求められる業務であり、法規制の変更への対応も欠かせません。
複雑な手続きの効率化や、ナレッジの蓄積にAIを活用できる可能性を考えてください。`,

  "newbuild": `新造船PM事業本部は、建造監理、技術PM、品質工程管理を一貫して担う大規模部門です。
複数の造船所、多岐にわたるステークホルダー、長期にわたるプロジェクトを管理します。
プロジェクト全体の見える化や、リスクの早期発見にAIを活用する可能性を探ってください。`,
};

// プロンプト生成関数
function generatePrompt(themeId: string, deptId: string): string {
  const theme = businessThemes.find(t => t.id === themeId);
  const dept = departments.find(d => d.id === deptId);
  if (!theme || !dept) return "";

  const themeAngle = themeAngles[themeId] || "";
  const deptCtx = deptContext[deptId] || "";

  return `## 探索テーマ：${theme.label}
## 対象：${dept.label}

---

### 文脈
${deptCtx}

---

### テーマへのアプローチ
${themeAngle}

---

### 探索の指針

上記の文脈を踏まえ、${dept.label}における「${theme.label}」に関するアイデアを探索してください。

**思考のポイント**
- 表面的な改善にとどまらず、本質的な価値創出を狙う
- 「あったらいいな」ではなく「これがないと困る」を目指す
- 実現可能性を意識しつつも、まずは理想形から発想する
- RAGドキュメントに記載された実態を参照し、地に足のついた提案をする

**アウトプット形式**
各アイデアについて以下を記述：
- 名称と概要（何ができるか／何が変わるか）
- なぜ有効か（現状の課題とのつながり）
- 期待される効果
- 実現へのハードル`;
}

export default function MetaFinderPage() {
  // 単発探索用の状態
  const [result, setResult] = useState<MetaFinderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // フリーテキストプロンプト
  const [freePrompt, setFreePrompt] = useState<string>("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // バッチ探索用の状態
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [latestBatch, setLatestBatch] = useState<BatchInfo | null>(null);
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);
  const [batchStarting, setBatchStarting] = useState(false);
  const [batchActiveTab, setBatchActiveTab] = useState<"top" | "theme" | "dept">("top");
  const [batchExpandedIdea, setBatchExpandedIdea] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // プログレスバーのシミュレーション（easeIn: 最初ゆっくり→後半加速）
  useEffect(() => {
    if (loading) {
      setProgress(0);
      const startTime = Date.now();
      const estimatedDuration = 30000; // 推定30秒

      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const t = elapsed / estimatedDuration;

        let p: number;
        if (t <= 1) {
          p = t * t * t * 92;
        } else {
          const overtime = t - 1;
          p = 92 + 5 * (1 - Math.exp(-overtime * 0.8));
        }
        setProgress(Math.min(p, 97));
      }, 200);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (progress > 0) {
        setProgress(100);
        setTimeout(() => setProgress(0), 500);
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [loading]);

  // セル選択時の処理（プロンプト表示のみ）
  const handleCellClick = (themeId: string, deptId: string) => {
    if (loading) return;

    setSelectedTheme(themeId);
    setSelectedDept(deptId);
    setResult(null);
    setError(null);

    const prompt = generatePrompt(themeId, deptId);
    setGeneratedPrompt(prompt);
  };

  // 探索実行
  const handleExplore = async () => {
    if (loading || !generatedPrompt) return;

    // 既存のリクエストをキャンセル
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/meta-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          additionalContext: generatedPrompt,
          themeId: selectedTheme,
          themeName: selectedThemeObj?.label,
          deptId: selectedDept,
          deptName: selectedDeptObj?.label,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "分析に失敗しました");
      }

      const data = await res.json();
      // APIレスポンスを新しい形式に変換（BSC 4視点）
      const ideas: DiscoveredIdea[] = (data.needs || []).map((need: { id: string; name: string; description: string; reason: string; financial: number; customer: number; process: number; growth: number }) => ({
        id: need.id,
        name: need.name,
        description: need.description,
        reason: need.reason,
        financial: need.financial,
        customer: need.customer,
        process: need.process,
        growth: need.growth,
      }));
      setResult({
        ideas,
        thinkingProcess: data.thinkingProcess,
        summary: data.summary,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // キャンセルは正常処理
        return;
      }
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // フリーテキスト探索実行
  const handleFreeExplore = async () => {
    if (loading || !freePrompt.trim()) return;

    // マトリクス選択をクリア
    setSelectedTheme(null);
    setSelectedDept(null);
    setGeneratedPrompt("");

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/meta-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          additionalContext: freePrompt.trim(),
          themeId: "freetext",
          themeName: "フリー探索",
          deptId: "all",
          deptName: "全社",
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "分析に失敗しました");
      }

      const data = await res.json();
      const ideas: DiscoveredIdea[] = (data.needs || []).map((need: { id: string; name: string; description: string; reason: string; financial: number; customer: number; process: number; growth: number }) => ({
        id: need.id,
        name: need.name,
        description: need.description,
        reason: need.reason,
        financial: need.financial,
        customer: need.customer,
        process: need.process,
        growth: need.growth,
      }));
      setResult({
        ideas,
        thinkingProcess: data.thinkingProcess,
        summary: data.summary,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // 音声入力トグル
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("このブラウザは音声認識に対応していません");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = freePrompt;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim = transcript;
        }
      }
      setFreePrompt(finalTranscript + interim);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // キャンセル処理
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setLoading(false);
    setProgress(0);
  };

  // ========== バッチ探索関連の関数 ==========

  // バッチ状態を取得
  const fetchBatchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/meta-finder/batch");
      const data = await res.json();
      setBatches(data.batches || []);
      setLatestBatch(data.latest || null);

      // 完了したバッチがあり、まだサマリーを読み込んでいなければ最新を取得
      const completedBatches = (data.batches || []).filter((b: BatchInfo) => b.status === "completed");
      if (completedBatches.length > 0 && !batchSummary && !selectedBatchId) {
        fetchBatchSummary(completedBatches[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch batch status:", error);
    }
  }, [batchSummary, selectedBatchId]);

  // サマリーを取得
  const fetchBatchSummary = async (batchId: string) => {
    try {
      const res = await fetch(`/api/meta-finder/batch/summary?batchId=${batchId}`);
      const data = await res.json();
      setBatchSummary(data);
      setSelectedBatchId(batchId);
    } catch (error) {
      console.error("Failed to fetch summary:", error);
    }
  };

  // バッチ処理を開始
  const startBatch = async () => {
    if (batchStarting) return;

    const confirmed = confirm(
      "全マトリックス探索を開始しますか？\n\n" +
      "・18テーマ × 14部門 = 252パターン\n" +
      "・推定所要時間: 約4時間\n" +
      "・就寝前の実行を推奨します"
    );

    if (!confirmed) return;

    try {
      setBatchStarting(true);
      const res = await fetch("/api/meta-finder/batch", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        alert(`バッチ処理を開始しました\n\nバッチID: ${data.batchId}\n推定時間: ${data.estimatedTime}`);
        fetchBatchStatus();
      } else {
        alert(data.error || "開始に失敗しました");
      }
    } catch (error) {
      console.error("Failed to start batch:", error);
      alert("バッチ処理の開始に失敗しました");
    } finally {
      setBatchStarting(false);
    }
  };

  // バッチ処理をキャンセル
  const cancelBatch = async () => {
    if (!latestBatch || latestBatch.status !== "running") return;

    const confirmed = confirm(
      "バッチ処理をキャンセルしますか？\n\n" +
      `現在の進捗: ${latestBatch.completedPatterns}/${latestBatch.totalPatterns}\n` +
      "これまでに発見したアイデアは保存されます。"
    );

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/meta-finder/batch?id=${latestBatch.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("バッチ処理をキャンセルしました");
        fetchBatchStatus();
      } else {
        const data = await res.json();
        alert(data.error || "キャンセルに失敗しました");
      }
    } catch (error) {
      console.error("Failed to cancel batch:", error);
      alert("キャンセルに失敗しました");
    }
  };

  // 全履歴を削除
  const clearAllHistory = async () => {
    const confirmed = confirm(
      "全ての探索履歴を削除しますか？\n\n" +
      "この操作は取り消せません。"
    );

    if (!confirmed) return;

    try {
      const res = await fetch("/api/meta-finder/batch?id=all", {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        alert(`${data.deletedCount}件の履歴を削除しました`);
        setBatches([]);
        setLatestBatch(null);
        setBatchSummary(null);
        setSelectedBatchId(null);
      } else {
        alert(data.error || "削除に失敗しました");
      }
    } catch (error) {
      console.error("Failed to clear history:", error);
      alert("削除に失敗しました");
    }
  };

  // バッチ状態の初回読み込みと定期更新
  useEffect(() => {
    // 初回読み込み
    fetchBatchStatus();

    // 実行中の場合は定期的に更新
    const interval = setInterval(() => {
      if (latestBatch?.status === "running") {
        fetchBatchStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchBatchStatus, latestBatch?.status]);

  // スコアに応じた色
  const getScoreColor = (score: number) => {
    if (score >= 4) return "text-green-600 dark:text-green-400";
    if (score >= 3) return "text-blue-600 dark:text-blue-400";
    if (score >= 2) return "text-yellow-600 dark:text-yellow-400";
    return "text-gray-600 dark:text-gray-400";
  };

  // バッチ進捗率
  const batchProgressPercent = latestBatch
    ? Math.round((latestBatch.completedPatterns / latestBatch.totalPatterns) * 100)
    : 0;

  // ========== ここまでバッチ関連 ==========

  const sortedIdeas = result?.ideas.sort((a, b) => {
    const scoreA = (a.financial + a.customer + a.process + a.growth) / 4;
    const scoreB = (b.financial + b.customer + b.process + b.growth) / 4;
    return scoreB - scoreA;
  });

  const selectedThemeObj = businessThemes.find(t => t.id === selectedTheme);
  const selectedDeptObj = departments.find(d => d.id === selectedDept);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
        <div className="max-w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <HomeButton />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                🌱 メタファインダー
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                テーマ × 対象 を選び、本質的な課題と打ち手を探索します
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-full mx-auto px-4 py-6">
        {/* ========== フリーテキストプロンプトボックス ========== */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            自由探索プロンプト
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">
              テーマを自由に入力して探索（マトリクスを使わない探索）
            </span>
          </h2>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <textarea
                value={freePrompt}
                onChange={(e) => setFreePrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleFreeExplore();
                  }
                }}
                placeholder="例：AIを使って船員教育をどう革新できるか？ / 洋上風力事業で他社と差別化するには？"
                className="w-full h-20 p-3 bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
              {isListening && (
                <span className="absolute top-2 right-2 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={toggleListening}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isListening
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300"
                }`}
                title={isListening ? "音声入力を停止" : "音声入力を開始"}
                disabled={loading}
              >
                {isListening ? "⏹ 停止" : "🎤 音声"}
              </button>
              <button
                onClick={handleFreeExplore}
                disabled={loading || !freePrompt.trim()}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg text-sm font-bold shadow-md transition-all disabled:cursor-not-allowed"
              >
                {loading ? "探索中..." : "🚀 探索"}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Ctrl+Enter で送信
          </p>
        </div>

        {/* ========== 全探索セクション（常に表示）========== */}
        {/* 進捗表示（実行中の場合のみ） */}
        {latestBatch?.status === "running" && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4 mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600 dark:text-slate-400">
                  {latestBatch.currentTheme} × {latestBatch.currentDept}
                </span>
                <span className="font-medium text-purple-600 dark:text-purple-400">
                  {latestBatch.completedPatterns}/{latestBatch.totalPatterns} ({batchProgressPercent}%)
                </span>
              </div>
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                  style={{ width: `${batchProgressPercent}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  発見済みアイデア: {latestBatch.totalIdeas}件
                </p>
                <button
                  onClick={cancelBatch}
                  className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-900 text-red-700 dark:text-red-300 rounded-lg transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 全探索履歴セクション（履歴がある場合のみ） */}
        {batches.length > 0 && latestBatch?.status !== "running" && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4 mb-6">
            <div className="space-y-4">
              {/* 履歴セレクター */}
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                  📚 全探索履歴
                </h3>
                {batchSummary && (
                  <button
                    onClick={() => exportMetaFinderPdf(batchSummary)}
                    className="px-2 py-1 text-xs bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded transition-colors"
                  >
                    📄 PDF出力
                  </button>
                )}
                <button
                  onClick={clearAllHistory}
                  className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded transition-colors"
                >
                  🗑️ 全削除
                </button>
                <div className="flex flex-wrap gap-2">
                  {batches.filter(b => b.status === "completed").map((batch, index) => (
                    <button
                      key={batch.id}
                      onClick={() => fetchBatchSummary(batch.id)}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                        selectedBatchId === batch.id
                          ? "bg-purple-600 text-white shadow-md"
                          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <span className="font-medium">
                        {index === 0 ? "最新" : `#${batches.filter(b => b.status === "completed").length - index}`}
                      </span>
                      <span className="ml-1.5 opacity-75">
                        {new Date(batch.startedAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
                      </span>
                      <span className="ml-1.5 text-purple-300 dark:text-purple-500">
                        {batch.totalIdeas}件
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* サマリー表示 */}
              {batchSummary && (
                <>
                  {/* 選択中のバッチ情報 */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>表示中:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {new Date(batchSummary.batch.startedAt).toLocaleString("ja-JP")}
                    </span>
                    <span>実行</span>
                    {batchSummary.batch.completedAt && (
                      <>
                        <span>→</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {new Date(batchSummary.batch.completedAt).toLocaleString("ja-JP")}
                        </span>
                        <span>完了</span>
                      </>
                    )}
                  </div>

                  {/* 統計カード */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {batchSummary.stats.totalIdeas}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">総アイデア数</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {batchSummary.stats.avgScore}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">平均スコア</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {batchSummary.scoreDistribution.excellent}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">高スコア (4+)</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {batchSummary.stats.maxScore?.toFixed(1)}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">最高スコア</div>
                    </div>
                  </div>

                  {/* タブ切り替え */}
                  <div className="bg-white dark:bg-slate-800 rounded-lg overflow-hidden">
                    <div className="flex border-b border-slate-200 dark:border-slate-700">
                      {[
                        { id: "top", label: "全体トップ30", count: batchSummary.topIdeas.length },
                        { id: "theme", label: "テーマ別ベスト", count: batchSummary.themeBest.length },
                        { id: "dept", label: "部門別ベスト", count: batchSummary.deptBest.length },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setBatchActiveTab(tab.id as "top" | "theme" | "dept")}
                          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                            batchActiveTab === tab.id
                              ? "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-b-2 border-purple-500"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                          }`}
                        >
                          {tab.label} ({tab.count})
                        </button>
                      ))}
                    </div>

                    {/* アイデアリスト */}
                    <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[400px] overflow-y-auto">
                      {(batchActiveTab === "top" ? batchSummary.topIdeas : batchActiveTab === "theme" ? batchSummary.themeBest : batchSummary.deptBest).map((idea, index) => (
                        <div
                          key={idea.id}
                          className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                          onClick={() => setBatchExpandedIdea(batchExpandedIdea === idea.id ? null : idea.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-full font-bold text-xs">
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-medium text-slate-800 dark:text-white text-sm">
                                  {idea.name}
                                </h3>
                                <span className={`text-sm font-bold ${getScoreColor(idea.score)}`}>
                                  {idea.score.toFixed(1)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded">
                                  {idea.themeName}
                                </span>
                                <span className="px-1.5 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded">
                                  {idea.deptName}
                                </span>
                              </div>

                              {batchExpandedIdea === idea.id && (
                                <div className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                                  <div>
                                    <span className="font-medium text-slate-500 dark:text-slate-400">概要</span>
                                    <p className="mt-0.5">{idea.description}</p>
                                  </div>
                                  {idea.actions && (() => {
                                    try {
                                      const actions: string[] = JSON.parse(idea.actions);
                                      return actions.length > 0 ? (
                                        <div>
                                          <span className="font-medium text-slate-500 dark:text-slate-400">具体的アクション</span>
                                          <ul className="mt-0.5 space-y-1 list-none">
                                            {actions.map((action, i) => (
                                              <li key={i} className="flex gap-1.5">
                                                <span className="text-blue-500 shrink-0">{i + 1}.</span>
                                                <span>{action}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : null;
                                    } catch { return null; }
                                  })()}
                                  <div>
                                    <span className="font-medium text-slate-500 dark:text-slate-400">なぜ有効か</span>
                                    <p className="mt-0.5">{idea.reason}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-2 pt-1 text-slate-500">
                                    <span>💰財務 {idea.financial}/5</span>
                                    <span>👥顧客 {idea.customer}/5</span>
                                    <span>⚙️業務 {idea.process}/5</span>
                                    <span>🌱成長 {idea.growth}/5</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* サマリーがない場合（初回ロード中など） */}
              {!batchSummary && batches.some(b => b.status === "completed") && (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                  <p className="text-sm">上の履歴ボタンをクリックして結果を表示</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Matrix Section */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4 mb-6 overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              探索マトリックス
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                セルをクリックして個別探索
              </span>
            </h2>
            <button
              onClick={startBatch}
              disabled={batchStarting || latestBatch?.status === "running"}
              className={`px-4 py-2 text-sm font-bold rounded-xl transition-all shadow-lg ${
                latestBatch?.status === "running"
                  ? "bg-yellow-500 text-white animate-pulse"
                  : "bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 shadow-purple-500/25"
              }`}
            >
              {batchStarting
                ? "開始中..."
                : latestBatch?.status === "running"
                ? `🌙 実行中 ${batchProgressPercent}%`
                : "🌙 全探索（252通り・約4時間）"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[1300px]">
              <thead>
                <tr>
                  <th className="p-2 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 sticky left-0 z-20 w-[40px]">
                    大項目
                  </th>
                  <th className="p-2 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 sticky left-[40px] z-20 min-w-[180px]">
                    小項目
                  </th>
                  {departments.map((dept) => (
                    <th
                      key={dept.id}
                      className={`p-2 border border-gray-200 dark:border-slate-600 text-center text-xs font-medium min-w-[90px] ${
                        dept.id === "all"
                          ? "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300"
                          : "bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                      }`}
                      title={dept.description}
                    >
                      {dept.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {themesByCategory.map((category) => (
                  category.themes.map((theme, themeIndex) => (
                    <tr key={theme.id}>
                      {/* 大項目セル（カテゴリの最初の行のみ表示、縦書き） */}
                      {themeIndex === 0 && (
                        <td
                          rowSpan={category.themes.length}
                          className={`p-1 border border-gray-200 dark:border-slate-600 text-center font-bold sticky left-0 z-10 ${category.color}`}
                          style={{ writingMode: "vertical-rl", textOrientation: "upright", width: "40px" }}
                        >
                          {category.label}
                        </td>
                      )}
                      {/* 小項目セル */}
                      <td
                        className="p-2 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 text-sm font-medium text-gray-700 dark:text-gray-300 sticky left-[40px] z-10"
                        title={theme.description}
                      >
                        {theme.label}
                      </td>
                      {/* 各部門のセル */}
                      {departments.map((dept) => {
                        const isSelected = selectedTheme === theme.id && selectedDept === dept.id;
                        const isLoading = isSelected && loading;
                        return (
                          <td
                            key={`${theme.id}-${dept.id}`}
                            className={`p-1 border border-gray-200 dark:border-slate-600 text-center cursor-pointer transition-all ${
                              isSelected
                                ? "bg-blue-500 dark:bg-blue-600 ring-2 ring-blue-400 ring-offset-1"
                                : "bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                            } ${loading && !isSelected ? "opacity-50 cursor-not-allowed" : ""}`}
                            onClick={() => handleCellClick(theme.id, dept.id)}
                          >
                            {isLoading ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                              </div>
                            ) : isSelected && result ? (
                              <span className="text-white font-bold text-sm">
                                {result.ideas.length}
                              </span>
                            ) : isSelected ? (
                              <span className="text-white text-lg">✓</span>
                            ) : (
                              <span className="text-gray-300 dark:text-slate-600 text-lg">•</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 選択情報と探索ボタン（表の直下） */}
        {selectedTheme && selectedDept && !result && (
          <div className="flex items-center gap-8 mb-6 flex-wrap">
            {/* 選択情報 */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-sm font-bold shadow-sm">
                {selectedThemeObj?.label}
              </span>
              <span className="text-gray-400 dark:text-gray-500">×</span>
              <span className="px-4 py-2 text-white rounded-lg text-sm font-bold shadow-sm bg-gradient-to-r from-emerald-500 to-emerald-600">
                {selectedDeptObj?.label}
              </span>
            </div>

            {/* 探索ボタン */}
            <button
              onClick={handleExplore}
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 disabled:cursor-not-allowed flex items-center gap-3"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>探索中...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>探索を開始</span>
                </>
              )}
            </button>
            {loading && (
              <button
                onClick={handleCancel}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                キャンセル
              </button>
            )}
          </div>
        )}

        {/* 処理中の表示（探索ボタン直下） */}
        {loading && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-blue-200 dark:border-blue-800/50 p-6 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  AIがバックグラウンドで探索中...
                </p>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                  RAGドキュメントと会社の文脈を参照しながら、アイデアを検討しています
                </p>
              </div>
            </div>
            <div className="w-full bg-blue-100 dark:bg-blue-900/50 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 dark:bg-blue-400 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, progress)}%` }}
              />
            </div>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-2 text-right">
              {Math.round(progress)}%
            </p>
          </div>
        )}

        {/* プロンプト表示エリア（処理中は非表示） */}
        {selectedTheme && selectedDept && !result && !loading && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-6">
            {/* プロンプト内容 */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
                <span>📝</span>
                <span>生成されたプロンプト</span>
              </h3>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans leading-relaxed">
                  {generatedPrompt}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            {/* Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4 mb-6">
              <div className="flex items-center gap-3 mb-3">
                {selectedThemeObj ? (
                  <>
                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
                      {selectedThemeObj.label}
                    </span>
                    <span className="text-gray-400">×</span>
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200">
                      {selectedDeptObj?.label}
                    </span>
                  </>
                ) : (
                  <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 rounded-full text-sm font-medium">
                    フリー探索
                  </span>
                )}
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                探索結果
              </h2>
              <p className="text-gray-700 dark:text-gray-300 text-sm">{result.summary}</p>

              <div className="mt-4">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {result.ideas.length}
                </span>
                <span className="text-gray-600 dark:text-gray-400 ml-2 text-sm">件のアイデア</span>
              </div>
            </div>

            {/* Ideas List */}
            <div className="space-y-3">
              {sortedIdeas?.map((idea, index) => {
                const score = (idea.financial + idea.customer + idea.process + idea.growth) / 4;
                const isExpanded = expandedIdea === idea.id;

                return (
                  <div
                    key={idea.id}
                    className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => setExpandedIdea(isExpanded ? null : idea.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                          #{index + 1}
                        </span>
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                            {idea.name}
                          </h3>
                          {!isExpanded && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                              {idea.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                          {score.toFixed(1)}点
                        </span>
                        <svg
                          className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600 space-y-3 text-sm">
                        <div>
                          <span className="font-medium text-slate-600 dark:text-slate-400">概要</span>
                          <p className="text-slate-700 dark:text-slate-300 mt-1">{idea.description}</p>
                        </div>
                        <div>
                          <span className="font-medium text-slate-600 dark:text-slate-400">なぜ有効か</span>
                          <p className="text-slate-700 dark:text-slate-300 mt-1">{idea.reason}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded text-xs">
                            💰財務: {idea.financial}/5
                          </span>
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs">
                            👥顧客: {idea.customer}/5
                          </span>
                          <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded text-xs">
                            ⚙️業務: {idea.process}/5
                          </span>
                          <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded text-xs">
                            🌱成長: {idea.growth}/5
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Thinking Process */}
            <details className="mt-6">
              <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 text-sm">
                🧠 思考プロセスを表示
              </summary>
              <div className="mt-4 bg-gray-50 dark:bg-slate-700 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {result.thinkingProcess}
              </div>
            </details>

            {/* 別の組み合わせを探索 */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700 text-center">
              <button
                onClick={() => {
                  setResult(null);
                  setSelectedTheme(null);
                  setSelectedDept(null);
                  setGeneratedPrompt("");
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                別の組み合わせを探索
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
