"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { getOreNaviAudio } from "@/lib/ore-navi-audio";

interface LifeValueImpact {
  reward: string;
  freedom: string;
  stress: string;
  meaning: string;
}

interface Insight {
  id: string;
  title: string;
  content: string;
  why_now: string;
  why_you: string;
  action: string;
  risk: string;
  lifevalue_impact: LifeValueImpact;
}

interface OreNaviResult {
  insights: Insight[];
  summary: string;
  warning: string;
}

interface HistoryItem {
  id: string;
  question: string;
  result: OreNaviResult;
  createdAt: string;
}

// 質問キューのアイテム
interface QueueItem {
  id: string;
  question: string;
  status: "pending" | "processing" | "completed" | "error";
  result?: OreNaviResult;
  error?: string;
}

// セクションタイプ（インサイト内のサブセクションも含む）
// insight-N-title, insight-N-content, insight-N-why_now, insight-N-why_you, insight-N-action, insight-N-risk
type SectionType = string;

// 定型の問い（仕事＋人生）
const presetQuestions = [
  // === 仕事：戦略・優先順位 ===
  { id: "focus", label: "今、最も注力すべきは？", question: "今、俺が最も注力すべきことは何か？会社の優先課題と俺の強みを踏まえて教えてくれ。" },
  { id: "blindspot", label: "盲点チェック", question: "今、俺が見落としている盲点は何か？会社の動きと俺の認識にズレはないか？" },
  { id: "legacy-2030", label: "2030年までの戦略", question: "2030年までの仕事人生で、俺がやるべきことは何か？CDIOとして最大のレガシーを残すには？" },
  { id: "legacy-2033", label: "2033年までの戦略", question: "2033年までを見据えて、俺がやるべきことは何か？CDIOとしてのキャリアの集大成をどう設計すべきか？" },
  { id: "legacy-2035", label: "2035年までの戦略", question: "2035年までの長期ビジョンとして、俺はどんなレガシーを残すべきか？仕事人生の最終章をどう描くべきか？" },
  { id: "weekly", label: "今週の振り返り", question: "今週、俺はLifeValue的に正しい選択ができていたか？来週の焦点は何にすべきか？" },
  { id: "quarter", label: "今四半期の勝負どころ", question: "今四半期で俺が絶対に成し遂げるべき1〜3つのことは何か？" },
  { id: "risk", label: "最大のリスクは？", question: "今、俺のキャリアや会社にとって最大のリスクは何か？どう備えるべきか？" },
  { id: "decision-pending", label: "決断すべき案件", question: "今、俺が先送りにしている決断は何か？なぜ決められないのか？どう決めるべきか？" },
  { id: "no-list", label: "やらないことリスト", question: "今の俺が「やらない」と決めるべきことは何か？断るべき依頼や手放すべき業務は？" },
  { id: "win-quick", label: "クイックウィン", question: "今週中に達成できる、インパクトの大きい成果は何か？" },
  { id: "cdio-value", label: "CDIO価値の最大化", question: "CDIOとしての俺の価値を最大化するために、今やるべきことは？" },
  { id: "succession", label: "後継者育成", question: "俺の後継者として育てるべき人材は誰か？どう育成すべきか？" },
  { id: "political", label: "社内政治の読み", question: "今、社内で起きている政治的な動きは何か？俺はどう立ち回るべきか？" },
  // === 仕事：AI・テクノロジー ===
  { id: "ai-self", label: "AIで俺を強化", question: "AIを使って俺自身の生産性や意思決定力を上げるには？具体的なツールや使い方を教えてくれ。" },
  { id: "ai-team", label: "AIでチーム強化", question: "AIを活用してチームの生産性を上げるには？導入すべきツールや仕組みは？" },
  { id: "claude", label: "Claude活用法", question: "俺がClaudeをもっと有効活用するには？今見逃している使い方はあるか？" },
  { id: "tech-trend", label: "注目すべき技術", question: "今、俺が個人的にキャッチアップすべき技術トレンドは何か？" },
  { id: "ai-strategy", label: "AI戦略", question: "会社のAI戦略として、今最も重要な打ち手は何か？" },
  { id: "automation", label: "自動化すべき業務", question: "今、自動化すべき業務やプロセスは何か？優先順位は？" },
  { id: "tech-debt", label: "技術的負債", question: "今、対処すべき技術的負債は何か？いつ、どう返済すべきか？" },
  { id: "dx-progress", label: "DX進捗確認", question: "会社のDXは計画通り進んでいるか？遅れている部分とその原因は？" },
  // === 仕事：時間・集中 ===
  { id: "time-waste", label: "時間の無駄撃ち", question: "俺が時間を無駄にしている習慣やタスクは何か？何をやめるべきか？" },
  { id: "deep-work", label: "深い仕事の確保", question: "俺が深い集中時間を確保するにはどうすればいい？何を変えるべきか？" },
  { id: "delegate", label: "委任すべき仕事", question: "俺がやっている仕事で、本来は委任すべきものは何か？" },
  { id: "meeting-audit", label: "会議の見直し", question: "俺が出ている会議で、不要なものはどれか？減らすべき会議は？" },
  { id: "interrupt", label: "割り込み対策", question: "俺の集中を妨げている割り込みは何か？どう防ぐべきか？" },
  { id: "morning-routine", label: "朝の使い方", question: "朝の時間をもっと有効に使うには？今の使い方の問題点は？" },
  // === 仕事：人間関係・影響力 ===
  { id: "stakeholder", label: "ステークホルダー戦略", question: "今、俺が関係を強化すべき重要人物は誰か？どうアプローチすべきか？" },
  { id: "influence", label: "影響力を高める", question: "俺の組織内での影響力を高めるには？何を変えるべきか？" },
  { id: "mentor", label: "メンタリング", question: "俺が育成すべき人材は誰か？どう関わるべきか？" },
  { id: "conflict", label: "対立の解消", question: "今、俺が抱えている対立や摩擦は何か？どう解消すべきか？" },
  { id: "trust-build", label: "信頼構築", question: "俺への信頼を高めるために、今すべきことは何か？" },
  { id: "communication", label: "伝え方の改善", question: "俺のコミュニケーションで改善すべき点は何か？誤解を生んでいないか？" },
  // === 人生：全体設計 ===
  { id: "life-design", label: "人生設計", question: "58歳の今、残りの人生をどう設計すべきか？仕事、家族、健康、趣味のバランスは？" },
  { id: "life-priority", label: "人生の優先順位", question: "今の俺にとって、本当に大切なことは何か？何を優先し、何を手放すべきか？" },
  { id: "regret-check", label: "後悔チェック", question: "このまま行くと、5年後に後悔しそうなことは何か？今から何を変えるべきか？" },
  { id: "65-vision", label: "65歳の俺", question: "65歳になった時、どんな状態でいたいか？そのために今から何を準備すべきか？" },
  { id: "70-vision", label: "70歳の俺", question: "70歳になった時、どんな生活を送っていたいか？仕事、趣味、社会との関わりは？" },
  { id: "bucket-list", label: "死ぬまでにやりたいこと", question: "俺が死ぬまでにやりたいことは何か？今から始められることは？" },
  { id: "life-theme", label: "人生のテーマ", question: "俺の人生のテーマは何か？何を追求し、何を残したいのか？" },
  { id: "time-bucket", label: "タイムバケット", question: "今しかできないことは何か？5年後、10年後ではもう遅いことは？" },
  // === 人生：家族・人間関係 ===
  { id: "family", label: "家族との関係", question: "家族との関係は良好か？もっと時間やエネルギーを割くべきか？" },
  { id: "important-people", label: "大切な人", question: "俺が大切にすべき人は誰か？その人たちとの関係を深めるには？" },
  { id: "isolation", label: "孤立防止", question: "俺は孤立していないか？仕事以外の人間関係は十分か？" },
  { id: "spouse", label: "配偶者との関係", question: "妻との関係は良好か？もっと時間を作るべきか？二人の時間の質は？" },
  { id: "friends", label: "友人関係", question: "俺には本当の友人がいるか？友人関係を深めるべきか？" },
  { id: "gratitude", label: "感謝を伝える", question: "俺が感謝を伝えるべき人は誰か？伝えていないことはないか？" },
  // === 人生：健康・フィジカル ===
  { id: "health", label: "健康状態", question: "俺の健康状態はどうか？身体が発しているサインを見逃していないか？" },
  { id: "running", label: "ランニング戦略", question: "ウルトラマラソンを続けるために、今の練習・休養・栄養は適切か？" },
  { id: "longevity", label: "長く動ける身体", question: "65歳以降も元気に動ける身体を作るために、今から何をすべきか？" },
  { id: "sleep", label: "睡眠の質", question: "俺の睡眠は十分か？睡眠の質を上げるために何をすべきか？" },
  { id: "recovery", label: "回復と休息", question: "俺は十分に回復できているか？休息の取り方は適切か？" },
  { id: "injury-prevention", label: "怪我予防", question: "怪我を予防するために、今やるべきことは何か？リスクの高い部位は？" },
  { id: "next-race", label: "次のレース戦略", question: "次のレースに向けて、どう準備すべきか？目標タイムと戦略は？" },
  { id: "nutrition", label: "栄養管理", question: "俺の食事・栄養は適切か？改善すべき点は？" },
  // === 人生：資産・経済 ===
  { id: "money", label: "資産設計", question: "65歳以降の経済的な準備は十分か？今から何をすべきか？" },
  { id: "freedom-money", label: "経済的自由", question: "働かなくても選択肢がある状態を作るには？今の資産形成は適切か？" },
  { id: "spending", label: "支出の見直し", question: "俺の支出で見直すべきものは何か？無駄遣いはないか？" },
  { id: "investment", label: "投資戦略", question: "今の投資戦略は適切か？リスク配分は？見直すべき点は？" },
  { id: "income-source", label: "収入源の多様化", question: "65歳以降の収入源をどう確保すべきか？今から準備できることは？" },
  { id: "insurance", label: "保険の見直し", question: "俺の保険は適切か？過不足はないか？見直すべき点は？" },
  // === 人生：学習・成長 ===
  { id: "curiosity", label: "好奇心の維持", question: "俺の好奇心は健在か？最近、心から面白いと思えたことは何か？" },
  { id: "new-challenge", label: "新しい挑戦", question: "俺が今から始めるべき新しい挑戦は何か？仕事以外で。" },
  { id: "skill-gap", label: "身につけるべきスキル", question: "俺が今から身につけるべきスキルは何か？仕事でも人生でも。" },
  { id: "reading", label: "読書計画", question: "俺が読むべき本は何か？今の読書習慣は十分か？" },
  { id: "learning-style", label: "学び方の最適化", question: "俺に合った学び方は何か？もっと効率的に学ぶには？" },
  { id: "mentor-find", label: "メンターを見つける", question: "俺が学ぶべき人は誰か？どうアプローチすべきか？" },
  // === 人生：意味・貢献 ===
  { id: "meaning", label: "人生の意味", question: "俺の人生に意味を与えているものは何か？それは十分か？" },
  { id: "contribution", label: "社会への貢献", question: "俺が次世代や社会に残せるものは何か？どう貢献すべきか？" },
  { id: "knowledge-transfer", label: "知識の伝承", question: "俺の知識や経験を誰にどう伝えるべきか？残すべきものは？" },
  { id: "community", label: "コミュニティへの関与", question: "俺が関わるべきコミュニティは？どう貢献できるか？" },
  { id: "volunteer", label: "ボランティア活動", question: "俺ができるボランティアや社会貢献活動は何か？" },
  { id: "writing", label: "書き残すべきこと", question: "俺が書き残すべきことは何か？本、ブログ、記録など。" },
  // === 共通：バランス・メンタル ===
  { id: "worklife", label: "仕事と生活", question: "俺の仕事と生活のバランスは適切か？家族との時間は十分か？" },
  { id: "burnout", label: "燃え尽き防止", question: "俺は燃え尽きに向かっていないか？ペースは持続可能か？" },
  { id: "energy", label: "エネルギー管理", question: "俺のエネルギーを最も消耗させているものは何か？どう対処すべきか？" },
  { id: "motivation", label: "モチベーション源", question: "今、俺のモチベーションを上げてくれるものは何か？下げているものは何か？" },
  { id: "stress-source", label: "ストレス源の特定", question: "今、俺のストレスの最大の原因は何か？どう対処すべきか？" },
  { id: "rumination", label: "反芻チェック", question: "俺は同じことを繰り返し考えていないか？頭から離れないことは何か？" },
  { id: "boundary", label: "境界線の確認", question: "俺の時間・尊厳・裁量を侵害しているものは何か？どう守るべきか？" },
  { id: "joy", label: "喜びの確認", question: "最近、俺が心から喜びを感じたことは何か？喜びが足りていないか？" },
  // === 追加：キャリア・転機 ===
  { id: "career-pivot", label: "キャリア転換点", question: "今がキャリアの転換点だとしたら、どの方向に舵を切るべきか？" },
  { id: "next-role", label: "次の役割", question: "CDIO後の俺の役割は何か？どんなポジションを目指すべきか？" },
  { id: "exit-strategy", label: "出口戦略", question: "会社を去るとしたら、いつ、どのような形が理想か？" },
  { id: "side-project", label: "副業・兼業", question: "今から始めるべき副業や兼業はあるか？どう準備すべきか？" },
  { id: "board-position", label: "役員ポジション", question: "将来、社外取締役やアドバイザーとして活躍するには今何をすべきか？" },
  { id: "consultant", label: "コンサル転身", question: "独立コンサルタントとしての可能性は？どの分野で勝負できるか？" },
  { id: "startup", label: "起業の可能性", question: "俺が起業するとしたら、どの領域で何をすべきか？" },
  { id: "acquisition", label: "買収・M&A視点", question: "俺の経験や人脈を活かして、どんなM&Aや事業買収に関われるか？" },
  // === 追加：ネットワーク・人脈 ===
  { id: "network-audit", label: "人脈の棚卸し", question: "俺の人脈で活用できていないものは？もっと深めるべき関係は？" },
  { id: "weak-ties", label: "弱い紐帯", question: "最近連絡を取っていない重要な人は誰か？再接続すべき人は？" },
  { id: "industry-network", label: "業界ネットワーク", question: "業界内での俺の存在感を高めるには？どのコミュニティに参加すべきか？" },
  { id: "cross-industry", label: "異業種交流", question: "異業種の人脈を広げるには？どの業界の人と繋がるべきか？" },
  { id: "alumni", label: "OB/OG活用", question: "俺の出身校や前職のネットワークをもっと活用できないか？" },
  { id: "linkedin", label: "LinkedIn戦略", question: "LinkedInなどのSNSをもっと活用するには？発信すべき内容は？" },
  { id: "introduce", label: "紹介すべき人", question: "俺の人脈の中で、お互いに紹介すべき人同士は誰か？" },
  { id: "event-attend", label: "参加すべきイベント", question: "今後参加すべきカンファレンスやイベントは何か？" },
  // === 追加：創造性・表現 ===
  { id: "creative-outlet", label: "創造的活動", question: "俺の創造性を発揮できる活動は何か？始めるべき趣味は？" },
  { id: "write-book", label: "本を書く", question: "俺が本を書くとしたら、どんなテーマで何を伝えるべきか？" },
  { id: "podcast", label: "ポッドキャスト", question: "俺がポッドキャストを始めるとしたら、どんな内容にすべきか？" },
  { id: "teaching", label: "教える活動", question: "大学や研修で教える機会を作るには？何を教えるべきか？" },
  { id: "art-culture", label: "芸術・文化", question: "俺が触れるべき芸術や文化は？感性を磨くには？" },
  { id: "music", label: "音楽との関わり", question: "音楽を通じて人生を豊かにするには？始めるべきことは？" },
  { id: "photography", label: "写真・映像", question: "写真や映像で何かを残すとしたら、何を撮るべきか？" },
  { id: "storytelling", label: "物語を伝える", question: "俺の人生の物語を誰かに伝えるとしたら、何を語るべきか？" },
  // === 追加：リーダーシップ・組織 ===
  { id: "leadership-style", label: "リーダーシップスタイル", question: "俺のリーダーシップスタイルの強みと弱みは？変えるべき点は？" },
  { id: "org-culture", label: "組織文化", question: "俺が組織文化に与えている影響は？もっと良くするには？" },
  { id: "talent-attract", label: "人材獲得", question: "優秀な人材を惹きつけるために、俺ができることは何か？" },
  { id: "diversity", label: "多様性推進", question: "組織の多様性を高めるために、俺がすべきことは？" },
  { id: "remote-work", label: "リモートワーク", question: "リモートワーク時代に俺のリーダーシップはどう進化すべきか？" },
  { id: "feedback", label: "フィードバック", question: "俺はチームに適切なフィードバックを与えているか？改善点は？" },
  { id: "empowerment", label: "権限委譲", question: "俺はもっと権限を委譲すべきか？誰に何を任せるべきか？" },
  { id: "vision-share", label: "ビジョン共有", question: "俺のビジョンはチームに伝わっているか？どう伝えるべきか？" },
  // === 追加：交渉・説得 ===
  { id: "negotiation", label: "交渉力", question: "俺の交渉力を高めるには？今抱えている交渉案件の戦略は？" },
  { id: "persuasion", label: "説得術", question: "俺が説得すべき相手は誰か？どうアプローチすべきか？" },
  { id: "presentation", label: "プレゼン力", question: "俺のプレゼンテーション能力を高めるには？" },
  { id: "pitch", label: "ピッチ準備", question: "経営陣への次のピッチで、俺が伝えるべき核心は何か？" },
  { id: "difficult-conv", label: "難しい会話", question: "俺が避けている難しい会話は何か？どう切り出すべきか？" },
  { id: "say-no", label: "断る力", question: "俺が断るべきなのに断れていないことは何か？" },
  { id: "ask-help", label: "助けを求める", question: "俺が助けを求めるべき相手は誰か？何を頼むべきか？" },
  { id: "conflict-resolve", label: "紛争解決", question: "組織内の対立を解決するために、俺がすべきことは？" },
  // === 追加：危機管理・レジリエンス ===
  { id: "crisis-prep", label: "危機への備え", question: "今起こりうる最悪の事態は何か？どう備えるべきか？" },
  { id: "plan-b", label: "プランB", question: "今の計画が失敗した場合のプランBは？準備できているか？" },
  { id: "resilience", label: "回復力", question: "俺のレジリエンスを高めるには？困難から立ち直る力は十分か？" },
  { id: "failure-learn", label: "失敗からの学び", question: "最近の失敗から俺が学ぶべきことは何か？" },
  { id: "worst-case", label: "最悪シナリオ", question: "キャリアにおける最悪のシナリオは？それでも大丈夫か？" },
  { id: "insurance-life", label: "人生の保険", question: "俺の人生における保険は十分か？リスクヘッジできているか？" },
  { id: "reputation", label: "評判管理", question: "俺の評判を傷つけるリスクは何か？どう守るべきか？" },
  { id: "legal-risk", label: "法的リスク", question: "俺が気をつけるべき法的リスクは何か？" },
  // === 追加：業界・市場 ===
  { id: "industry-future", label: "業界の未来", question: "海運・海事業界の5年後はどうなっているか？どう備えるべきか？" },
  { id: "competition", label: "競合分析", question: "会社の最大の脅威となる競合は？俺は何をすべきか？" },
  { id: "market-shift", label: "市場の変化", question: "今起きている市場の変化で、俺が対応すべきものは？" },
  { id: "regulation", label: "規制動向", question: "今後の規制変更で注意すべきものは？どう準備するか？" },
  { id: "global-trend", label: "グローバルトレンド", question: "世界の潮流で、俺がキャッチアップすべきものは？" },
  { id: "china-factor", label: "中国ファクター", question: "中国の動向が俺の仕事に与える影響は？どう対応すべきか？" },
  { id: "sustainability-biz", label: "サステナビリティ事業", question: "サステナビリティをビジネス機会に変えるには？" },
  { id: "digital-disruption", label: "デジタル破壊", question: "業界のデジタルディスラプションにどう対応すべきか？" },
  // === 追加：自己理解・内省 ===
  { id: "values-check", label: "価値観の確認", question: "俺の核となる価値観は何か？それに沿って生きているか？" },
  { id: "strength-weakness", label: "強み弱み", question: "俺の真の強みと弱みは何か？客観的に見て。" },
  { id: "blind-self", label: "自己の盲点", question: "俺が自分について知らないことは何か？他人から見た俺は？" },
  { id: "fear", label: "恐れの正体", question: "俺が最も恐れていることは何か？その恐れは正当か？" },
  { id: "ego-check", label: "エゴチェック", question: "俺のエゴが邪魔をしていることはないか？手放すべきものは？" },
  { id: "authenticity", label: "本当の自分", question: "俺は本当の自分として生きているか？仮面を被っていないか？" },
  { id: "life-review", label: "人生の振り返り", question: "58年の人生を振り返って、俺が学んだ最も重要なことは？" },
  { id: "unfinished", label: "未完了のこと", question: "俺の人生で未完了のままになっていることは何か？完了させるべきか？" },
  // === 追加：旅・体験 ===
  { id: "travel-next", label: "次の旅", question: "次に行くべき場所はどこか？なぜそこなのか？" },
  { id: "adventure", label: "冒険", question: "俺が挑戦すべき冒険的な体験は何か？" },
  { id: "experience-gift", label: "体験のギフト", question: "家族や大切な人と一緒にすべき体験は何か？" },
  { id: "solo-trip", label: "一人旅", question: "一人で行くべき場所や体験は？なぜ一人で行く必要があるか？" },
  { id: "nature", label: "自然との接点", question: "自然の中で過ごす時間は十分か？もっと増やすべきか？" },
  { id: "new-experience", label: "新しい体験", question: "今年中にすべき新しい体験は何か？" },
  { id: "cultural-immersion", label: "文化体験", question: "異文化に触れる機会は十分か？どこの文化を学ぶべきか？" },
  { id: "milestone-celebrate", label: "節目の祝い", question: "俺が祝うべき節目は何か？どう祝うべきか？" },
  // === 逆説・挑発：思考の枠を壊す ===
  { id: "devil-advocate", label: "悪魔の代弁者", question: "俺が今「正しい」と信じていることの中で、実は間違っているものは何か？反論してくれ。" },
  { id: "fire-yourself", label: "俺をクビにしろ", question: "もし俺が明日CDIOをクビになったら、後任は俺のやってきたことの何を真っ先に変えるか？" },
  { id: "enemy-view", label: "敵の目で見ろ", question: "俺を潰したい競合やライバルがいるとしたら、俺の最大の弱点をどう突くか？" },
  { id: "obituary", label: "俺の訃報記事", question: "明日死んだら、新聞の訃報に何と書かれるか？それは俺が望む内容か？足りないものは？" },
  { id: "anti-pattern", label: "俺の悪癖パターン", question: "俺が繰り返し陥る失敗パターンは何か？同じ穴に落ち続けていないか？具体的に。" },
  { id: "impostor", label: "インポスター告白", question: "俺が内心「バレたらまずい」と思っている能力の不足や虚勢は何か？正直に分析してくれ。" },
  { id: "uncomfortable-truth", label: "不都合な真実", question: "俺について、周囲の人が思っているが面と向かって言えないことは何か？" },
  { id: "sunk-cost", label: "サンクコスト監査", question: "俺が「ここまでやったから」という理由だけで続けているものは何か？今すぐ損切りすべきは？" },
  // === 思考実験・フレームワーク ===
  { id: "inversion", label: "逆転思考", question: "俺が最悪のCDIOになるには何をすればいい？その逆をやっているか？" },
  { id: "10x-thinking", label: "10倍思考", question: "今の成果を10倍にするには？10%改善ではなく、根本的にやり方を変えるとしたら？" },
  { id: "zero-base", label: "ゼロから再構築", question: "もし今日入社したばかりで、CDIOのポストに就いたとしたら、最初の90日で何をする？" },
  { id: "time-travel", label: "10年前の俺へ", question: "10年前の自分に1つだけ忠告できるとしたら何と言う？そして10年後の俺は今の俺に何と言うか？" },
  { id: "last-day", label: "最後の出社日", question: "今日が会社での最後の日だとしたら、俺は何を後悔し、何を誇りに思うか？" },
  { id: "alien-perspective", label: "宇宙人の目", question: "地球に来た宇宙人が俺の日常を1週間観察したら、何を『非合理的だ』と指摘するか？" },
  { id: "younger-self", label: "25歳の俺が見たら", question: "25歳の小山成生が今の俺を見たら、何に怒り、何に失望し、何に驚くか？" },
  { id: "ceo-for-a-day", label: "社長を1日やるなら", question: "もし1日だけ社長の権限をもらえたら、会社に対して何をする？なぜそれを今提案していないのか？" },
  // === 深層心理・本音 ===
  { id: "midnight-thought", label: "深夜3時の不安", question: "深夜3時に目が覚めた時、俺の頭を支配する不安は何か？それは本当に対処不能なのか？" },
  { id: "secret-desire", label: "言えない野望", question: "俺が人に言えない本当の野望は何か？なぜ言えないのか？実現可能か？" },
  { id: "jealousy-signal", label: "嫉妬が教えること", question: "俺が最近、嫉妬を感じた相手は誰か？その嫉妬は俺の本当の欲求の何を教えてくれるか？" },
  { id: "anger-decode", label: "怒りの翻訳", question: "最近、俺が強い怒りを感じた場面は？その怒りの裏にある本当の感情は何か？" },
  { id: "permission-slip", label: "自分への許可証", question: "俺が自分に許可を出せていないことは何か？『これをやってもいい』と言ってやるべきことは？" },
  { id: "guilty-pleasure", label: "後ろめたい喜び", question: "俺が密かに楽しんでいるが、恥ずかしくて人に言えないことは何か？それは本当に恥ずべきことか？" },
  { id: "pretending", label: "演技をやめたら", question: "俺が仕事で演技している部分は何か？その仮面を外したら何が起きるか？" },
  // === 関係性の深堀り ===
  { id: "toxic-relationship", label: "毒になる関係", question: "俺のエネルギーを奪っている人間関係は何か？距離を置くべき相手はいるか？" },
  { id: "unsaid-words", label: "言えなかった言葉", question: "俺が誰かに言うべきだったのに言えなかった言葉は何か？今からでも伝えるべきか？" },
  { id: "apology-owed", label: "借りている謝罪", question: "俺が誰かに謝るべきなのに、まだ謝っていないことは何か？" },
  { id: "who-needs-me", label: "俺を必要としてる人", question: "今、本当に俺を必要としている人は誰か？俺はその人に十分に応えているか？" },
  // === 逆張り戦略 ===
  { id: "do-nothing", label: "何もしない選択", question: "もし俺が向こう3ヶ月、新しいことを一切始めず今あるものだけに集中したら何が起きるか？" },
  { id: "embrace-chaos", label: "混乱を抱きしめろ", question: "俺が必死にコントロールしようとしているが、実は手放した方がうまくいくものは何か？" },
  { id: "be-wrong", label: "間違える勇気", question: "俺が『間違えたくない』と思うあまり動けていないことは何か？間違えた場合の最悪の結果は？" },
  { id: "slow-down", label: "遅くしてみろ", question: "俺がスピードを求めすぎて壊しているものは何か？あえてゆっくりやるべきことは？" },
  { id: "quit-something", label: "辞める美学", question: "今、勇気を持って辞めるべきことは何か？続けることが美徳とは限らない。何を手放す？" },
  { id: "boring-solution", label: "つまらない正解", question: "俺が派手な解決策ばかり追い求めて見逃している、地味だが確実な打ち手は何か？" },
  // === 身体知・直感 ===
  { id: "gut-feeling", label: "直感は何と言ってる", question: "頭では正しいとわかっているが、腹の底で違和感を感じていることは何か？その直感を信じるべきか？" },
  { id: "body-signal", label: "身体が出すサイン", question: "最近、身体が出している警告サインは何か？肩の凝り、胃の重さ、不眠…それは何を意味するか？" },
  { id: "flow-state", label: "ゾーンに入る条件", question: "俺が最後にフロー状態を経験したのはいつか？その条件を意図的に再現するには？" },
  // === 死角を突く問い ===
  { id: "what-if-ai-replaces", label: "AIに俺が要らない日", question: "5年後、AIがCDIOの仕事の80%をこなせるようになったら、俺の存在価値は何に変わるか？" },
  { id: "company-without-me", label: "俺なしの会社", question: "俺が明日いなくなっても会社は回るか？回るなら俺の本当の価値はどこにある？回らないならそれは組織の欠陥では？" },
  { id: "success-trap", label: "成功の罠", question: "過去の成功体験が、今の俺の足かせになっていることは何か？成功パターンへの執着が新しい可能性を殺していないか？" },
  { id: "privilege-check", label: "特権の自覚", question: "俺が当たり前だと思っているが、実は恵まれた立場ゆえのものは何か？その自覚が足りないせいで見えないものは？" },
  { id: "decay-check", label: "腐り始めの兆候", question: "俺の思考やスキルで、すでに陳腐化が始まっているものは何か？まだ気づいていない劣化は？" },
  { id: "paradox", label: "矛盾を直視しろ", question: "俺が同時に信じている矛盾した信念は何か？その矛盾を解消する必要があるか、共存させるべきか？" },
];

export default function OreNaviPage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<OreNaviResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [isImproving, setIsImproving] = useState(false);

  // 質問キュー
  const [questionQueue, setQuestionQueue] = useState<QueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const queueProcessingRef = useRef(false);

  // キュー自動再生
  const [autoPlayQueue, setAutoPlayQueue] = useState(true); // デフォルトでON
  const [playingQueueIndex, setPlayingQueueIndex] = useState<number>(-1);
  const lastPlayedIndexRef = useRef<number>(-1);
  const currentPlayingIdRef = useRef<string | null>(null); // 現在再生中のアイテムID

  // プログレスバー関連
  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 履歴関連
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);

  // 履歴を取得
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/ore-navi?limit=50");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // 履歴を削除
  const deleteHistory = async (id: string) => {
    try {
      const res = await fetch(`/api/ore-navi?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setHistory((prev) => prev.filter((h) => h.id !== id));
        if (viewingHistoryId === id) {
          setResult(null);
          setViewingHistoryId(null);
          setQuestion("");
        }
      }
    } catch (err) {
      console.error("Failed to delete history:", err);
    }
  };

  // 履歴を表示
  const viewHistory = (item: HistoryItem) => {
    setQuestion(item.question);
    setResult(item.result);
    setViewingHistoryId(item.id);
    setShowHistory(false);
  };

  // 履歴パネルを開いた時に履歴を取得
  useEffect(() => {
    if (showHistory && history.length === 0) {
      fetchHistory();
    }
  }, [showHistory, history.length, fetchHistory]);

  // プログレスバーのシミュレーション（easeIn: 最初ゆっくり→後半加速→85%キャップ）
  // 100%はレスポンス到着時のみ（loading=false時にアニメーション）
  useEffect(() => {
    if (loading) {
      setProgress(0);
      const startTime = Date.now();
      const estimatedDuration = 25000; // 推定25秒

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

  // TTS関連（グローバル音声マネージャーを使用）
  const [speechSpeed, setSpeechSpeed] = useState(140); // 50-200%
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioCurrentSection, setAudioCurrentSection] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState({ total: 0, ready: 0, generating: 0, pending: 0 });

  // グローバル音声マネージャーの状態を購読
  useEffect(() => {
    const audioManager = getOreNaviAudio();
    if (!audioManager) return;

    const unsubscribe = audioManager.subscribe((state) => {
      setIsPlaying(state.isPlaying);
      setIsPaused(state.isPaused);
      setAudioCurrentSection(state.currentSection);
      setQueueStatus(state.queueStatus);

      // 音声のcurrentSectionをUIのcurrentSectionに同期
      if (state.currentSection) {
        setCurrentSection(state.currentSection);
        // インサイトの自動展開
        const match = state.currentSection.match(/^insight-(\d+)/);
        if (match && result) {
          const insightIndex = parseInt(match[1], 10);
          const insight = result.insights[insightIndex];
          if (insight) {
            setExpandedInsight(insight.id);
          }
        } else {
          setExpandedInsight(null);
        }
      } else if (!state.isPlaying) {
        setCurrentSection(null);
      }
    });

    // 初期速度を設定
    audioManager.setSpeechSpeed(speechSpeed);

    return unsubscribe;
  }, [result, speechSpeed]);

  // speechSpeedが変更されたらマネージャーに通知
  useEffect(() => {
    const audioManager = getOreNaviAudio();
    if (audioManager) {
      audioManager.setSpeechSpeed(speechSpeed);
    }
  }, [speechSpeed]);

  // ハイライト関連
  const [currentSection, setCurrentSection] = useState<SectionType | null>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // セクションのrefを設定
  const setSectionRef = useCallback((section: string, el: HTMLDivElement | null) => {
    if (el) {
      sectionRefs.current.set(section, el);
    }
  }, []);

  // ハイライト時に自動スクロール
  useEffect(() => {
    if (currentSection) {
      // 少し遅延させてDOMの更新を待つ
      const timer = setTimeout(() => {
        const el = sectionRefs.current.get(currentSection);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          console.log(`Auto-scrolling to section: ${currentSection}`);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentSection]);

  // セクションごとのテキストを取得
  const getSectionText = (res: OreNaviResult, section: SectionType): string => {
    if (section === "summary") {
      return res.summary;
    }
    if (section === "warning") {
      return "警告: " + res.warning;
    }

    // インサイトのサブセクション: insight-N-subsection
    const subMatch = section.match(/^insight-(\d+)-(\w+)$/);
    if (subMatch) {
      const index = parseInt(subMatch[1], 10);
      const subSection = subMatch[2];
      const insight = res.insights[index];
      if (insight) {
        switch (subSection) {
          case "title":
            return `${index + 1}つ目。${insight.title}`;
          case "content":
            return insight.content;
          case "why_now":
            return "なぜ今か。" + insight.why_now;
          case "why_you":
            return "なぜあなたか。" + insight.why_you;
          case "action":
            return "次の一手。" + insight.action;
          case "risk":
            return insight.risk ? "注意点。" + insight.risk : "";
        }
      }
    }
    return "";
  };

  // セクションからインサイトインデックスを取得
  const getInsightIndexFromSection = (section: SectionType): number | null => {
    const match = section.match(/^insight-(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  };

  // セクションリストを取得（サブセクション含む）
  const getSections = (res: OreNaviResult): SectionType[] => {
    const sections: SectionType[] = ["summary"];
    if (res.warning) {
      sections.push("warning");
    }
    res.insights.forEach((insight, i) => {
      // 各インサイトのサブセクション
      sections.push(`insight-${i}-title`);
      sections.push(`insight-${i}-content`);
      sections.push(`insight-${i}-why_now`);
      sections.push(`insight-${i}-why_you`);
      sections.push(`insight-${i}-action`);
      if (insight.risk) {
        sections.push(`insight-${i}-risk`);
      }
    });
    return sections;
  };

  // 全セクションを順番に再生（グローバルマネージャー経由）
  const generateSpeech = async () => {
    const audioManager = getOreNaviAudio();
    if (!result || !audioManager) return;

    // 再生中なら何もしない
    if (isPlaying) return;

    // ポーズ中なら再開（audio.pausedとcurrentTimeで確実に判定）
    if (audioManager.isCurrentlyPaused()) {
      audioManager.togglePlayPause();
      return;
    }

    const sections = getSections(result);
    const sectionsData = sections
      .map((section) => ({
        section,
        text: getSectionText(result, section),
      }))
      .filter((s) => s.text.trim());

    await audioManager.generateAndPlay(sectionsData);
  };

  // 指定セクションから再生を開始
  const playSectionsFrom = async (startSection: SectionType) => {
    const audioManager = getOreNaviAudio();
    if (!result || !audioManager) return;

    // キャッシュがあればそこから再生
    if (audioManager.hasCache()) {
      await audioManager.playFromSection(startSection);
    } else {
      // キャッシュがなければ全体を生成してから再生
      const sections = getSections(result);
      const sectionsData = sections
        .map((section) => ({
          section,
          text: getSectionText(result, section),
        }))
        .filter((s) => s.text.trim());

      await audioManager.generateAndPlay(sectionsData, startSection);
    }
  };

  // セクションをクリックしてそこから読み上げ開始
  const handleSectionClick = (section: SectionType) => {
    // 再生中なら、そのセクションから再開
    if (isPlaying) {
      playSectionsFrom(section);
    }
  };

  // 再生/一時停止
  const togglePlayPause = () => {
    const audioManager = getOreNaviAudio();
    if (!audioManager) return;
    audioManager.togglePlayPause();
  };

  // 停止
  const stopSpeech = () => {
    const audioManager = getOreNaviAudio();
    if (!audioManager) return;
    audioManager.stop();
    setCurrentSection(null);
    setExpandedInsight(null);
  };

  // 単一アイテムを処理（並列実行可能）
  const processItem = async (itemId: string, itemQuestion: string) => {
    const TIMEOUT_MS = 180000; // 3分タイムアウト

    // ステータスを処理中に変更
    setQuestionQueue((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, status: "processing" as const } : item
      )
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch("/api/ore-navi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: itemQuestion }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "エラーが発生しました");
      }

      const data = await res.json();

      setQuestionQueue((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, status: "completed" as const, result: data }
            : item
        )
      );
    } catch (err) {
      clearTimeout(timeoutId);
      const errorMsg = err instanceof Error && err.name === "AbortError"
        ? `タイムアウト（${TIMEOUT_MS / 1000}秒）`
        : err instanceof Error ? err.message : "エラーが発生しました";

      setQuestionQueue((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, status: "error" as const, error: errorMsg }
            : item
        )
      );
    }
  };

  // キューに質問を追加し、即座に並列処理を開始
  const handleSubmit = async (q?: string) => {
    const targetQuestion = q || question;
    if (!targetQuestion.trim()) return;

    // 新しいキューセッション開始時にリセット
    if (questionQueue.length === 0) {
      lastPlayedIndexRef.current = -1;
      currentPlayingIdRef.current = null;
      setPlayingQueueIndex(-1);
    }

    // 新しいアイテムを作成
    const newItem: QueueItem = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      question: targetQuestion,
      status: "pending",
    };

    // キューに追加
    setQuestionQueue((prev) => [...prev, newItem]);
    setQuestion("");

    // 即座に処理を開始（並列）
    processItem(newItem.id, targetQuestion);
  };

  // 処理中のアイテム数を監視
  useEffect(() => {
    const processingCount = questionQueue.filter((item) => item.status === "processing").length;
    setLoading(processingCount > 0);
    setIsProcessingQueue(processingCount > 0);
  }, [questionQueue]);

  // キューからアイテムを削除
  const removeFromQueue = (id: string) => {
    setQuestionQueue((prev) => prev.filter((item) => item.id !== id));
  };

  // キューの結果を表示
  const viewQueueResult = (item: QueueItem) => {
    if (item.result) {
      setResult(item.result);
      setQuestion(item.question);
    }
  };

  // キュー再生を参照で保持（相互参照のため）
  const questionQueueRef = useRef<QueueItem[]>([]);
  questionQueueRef.current = questionQueue;
  const autoPlayQueueRef = useRef(true);
  autoPlayQueueRef.current = autoPlayQueue;

  // キューアイテムの結果を再生し、完了後に次へ自動遷移
  const playQueueItemResult = useCallback(async (queueItem: QueueItem, index: number) => {
    const audioManager = getOreNaviAudio();
    if (!queueItem.result || !audioManager) return;

    currentPlayingIdRef.current = queueItem.id;
    setPlayingQueueIndex(index);
    setResult(queueItem.result);
    setQuestion(queueItem.question);

    const sections = getSections(queueItem.result);
    const sectionsData = sections
      .map((section) => ({
        section,
        text: getSectionText(queueItem.result!, section),
      }))
      .filter((s) => s.text.trim());

    console.log(`[AutoPlay] Playing item ${index}: "${queueItem.question.slice(0, 30)}..." (${sectionsData.length} sections)`);

    await audioManager.generateAndPlay(sectionsData);

    // 再生完了 → 自動再生が有効なら次のアイテムへ
    if (!autoPlayQueueRef.current) {
      console.log("[AutoPlay] Auto-play disabled, stopping");
      setPlayingQueueIndex(-1);
      currentPlayingIdRef.current = null;
      return;
    }

    // 最新のキュー状態から次の完了済みアイテムを探す
    const currentQueue = questionQueueRef.current;
    const completedItems = currentQueue.filter(item => item.status === "completed");
    const nextIndex = lastPlayedIndexRef.current + 1;

    console.log(`[AutoPlay] Item done. lastPlayed=${lastPlayedIndexRef.current}, nextIndex=${nextIndex}, completedCount=${completedItems.length}`);

    if (nextIndex < completedItems.length) {
      const nextItem = completedItems[nextIndex];
      lastPlayedIndexRef.current = nextIndex;
      // 少し間を空けてから次へ
      await new Promise(resolve => setTimeout(resolve, 500));
      playQueueItemResult(nextItem, currentQueue.indexOf(nextItem));
    } else {
      // 全部再生完了
      console.log("[AutoPlay] All items played");
      setPlayingQueueIndex(-1);
      currentPlayingIdRef.current = null;
    }
  }, []);

  // 新しいアイテムが完了したら自動再生開始（最初の1件目のみ）
  useEffect(() => {
    if (!autoPlayQueue) return;

    const completedItems = questionQueue.filter(item => item.status === "completed");

    // 最初の完了アイテムが出たら再生開始
    if (completedItems.length > 0 && lastPlayedIndexRef.current < 0 && !isPlaying) {
      console.log("[AutoPlay Effect] First completed item detected, starting playback");
      lastPlayedIndexRef.current = 0;
      const firstCompleted = completedItems[0];
      playQueueItemResult(firstCompleted, questionQueue.indexOf(firstCompleted));
    }
  }, [questionQueue, autoPlayQueue, isPlaying, playQueueItemResult]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setProgress(0);
  };

  const handlePresetClick = (preset: typeof presetQuestions[0]) => {
    setQuestion(preset.question);
    // テキストボックスにエントリーするだけで、送信はユーザーに任せる
    // フォーカスを当てて編集可能にする
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        // カーソルを末尾に移動
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    }, 0);
  };

  // LLMでテキストを改善
  const handleImproveText = async () => {
    if (!question.trim() || isImproving) return;

    setIsImproving(true);
    try {
      const res = await fetch("/api/improve-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: question }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.content) {
          setQuestion(data.content);
        }
      }
    } catch (err) {
      console.error("Failed to improve text:", err);
    } finally {
      setIsImproving(false);
    }
  };

  const getImpactIcon = (impact: string) => {
    if (impact === "+" || impact.includes("+") || impact.toLowerCase().includes("positive")) return "↑";
    if (impact === "-" || impact.includes("-") || impact.toLowerCase().includes("negative")) return "↓";
    return "→";
  };

  const getImpactColor = (impact: string) => {
    if (impact === "+" || impact.includes("+") || impact.toLowerCase().includes("positive")) return "text-emerald-600 dark:text-emerald-400";
    if (impact === "-" || impact.includes("-") || impact.toLowerCase().includes("negative")) return "text-red-600 dark:text-red-400";
    return "text-gray-500 dark:text-gray-400";
  };

  // ハイライトスタイル
  const getHighlightStyle = (section: SectionType) => {
    if (currentSection === section) {
      return "ring-2 ring-amber-400 bg-amber-900/30 shadow-lg shadow-amber-500/20 scale-[1.01]";
    }
    return "";
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header - 裏サイト感のあるダークデザイン */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-slate-500 hover:text-slate-300 transition-colors text-sm"
            >
              ← 表へ戻る
            </Link>
            <div className="h-4 w-px bg-slate-700" />
            <div>
              <h1 className="text-xl font-bold text-amber-400 flex items-center gap-2">
                <span className="text-2xl">🧭</span>
                俺ナビ
              </h1>
              <p className="text-slate-500 text-xs">Developer Only - 7次元の探索</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) fetchHistory();
              }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                showHistory
                  ? "bg-amber-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              <span>📜</span>
              <span>履歴</span>
              {history.length > 0 && (
                <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">
                  {history.length}
                </span>
              )}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* 履歴パネル */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowHistory(false)}
          />
          <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-700 h-full overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📜</span>
                探索履歴
              </h2>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-slate-500 text-center py-8">履歴がありません</p>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                        viewingHistoryId === item.id
                          ? "bg-amber-900/30 border-amber-700"
                          : "bg-slate-800 border-slate-700 hover:border-slate-600"
                      }`}
                      onClick={() => viewHistory(item)}
                    >
                      <p className="text-white text-sm line-clamp-2 mb-2">
                        {item.question}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-slate-500 text-xs">
                          {new Date(item.createdAt).toLocaleString("ja-JP", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("この履歴を削除しますか？")) {
                              deleteHistory(item.id);
                            }
                          }}
                          className="p-1 hover:bg-slate-700 rounded transition-colors"
                          title="削除"
                        >
                          <svg className="w-4 h-4 text-slate-500 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      {item.result.summary && (
                        <p className="text-amber-400/70 text-xs mt-2 line-clamp-1">
                          {item.result.summary}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="w-full px-6 py-8">
        {/* 北極星の表示 */}
        <div className="mb-6 p-4 bg-slate-900/50 border border-slate-800 rounded-lg w-full">
          <p className="text-amber-400/80 text-sm">
            <span className="font-bold text-emerald-400">+</span> ドーパミン・βエンドルフィン・セロトニン・オキシトシン・エンドカンナビノイド
          </p>
          <p className="text-amber-400/80 text-sm">
            <span className="font-bold text-red-400">−</span> コルチゾール・アドレナリン（ノルアドレナリンは両面）
          </p>
          <p className="text-slate-500 text-xs mt-1">58歳 / CDIO / 多角的に考える / 固定観念を疑う</p>
        </div>

        {/* 入力エリア - 常に表示（キューに複数追加可能） */}
        <div className="mb-6 w-full flex gap-3 items-stretch">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="問いを入力...（例：この案件に俺が関わるべき？）"
            className="flex-1 h-20 p-4 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
          />
          {/* LLM改善ボタン */}
          <button
            onClick={handleImproveText}
            disabled={isImproving || loading || !question.trim()}
            className="px-4 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 border border-slate-700 rounded-lg transition-colors flex flex-col items-center justify-center text-sm leading-tight"
          >
            {isImproving ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full" />
                <span className="text-xs mt-1">改善中</span>
              </>
            ) : (
              <>
                <span>文章</span>
                <span>改善</span>
              </>
            )}
          </button>
          {/* 問うボタン - loading中もキューに追加可能 */}
          <button
            onClick={() => handleSubmit()}
            disabled={!question.trim()}
            className="px-6 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <span>🚀</span>
            <span>{loading ? "追加" : "問う"}</span>
          </button>
          {loading && (
            <button
              onClick={handleCancel}
              className="px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              キャンセル
            </button>
          )}
        </div>

        {/* クイックアクセス - 常に表示（コンパクト） */}
        <div className="mb-4 w-full">
          <div className="flex flex-wrap gap-1.5">
            {presetQuestions.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset)}
                className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 rounded text-sm text-slate-400 hover:text-slate-200 transition-colors"
                title={preset.question}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* 質問キュー表示 - バッジの下 */}
        {questionQueue.length > 0 && (
          <div className="mb-6 w-full">
                <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      <span>📋</span>
                      質問キュー
                      <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">
                        {questionQueue.length}
                      </span>
                    </h3>
                    <div className="flex items-center gap-3">
                      {/* 自動再生トグル */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoPlayQueue}
                          onChange={(e) => setAutoPlayQueue(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                        />
                        <span className="text-xs text-slate-400">自動再生</span>
                      </label>
                      {questionQueue.some(item => item.status === "completed" || item.status === "error") && (
                        <button
                          onClick={() => {
                            setQuestionQueue(prev => prev.filter(item => item.status === "pending" || item.status === "processing"));
                            lastPlayedIndexRef.current = -1;
                            currentPlayingIdRef.current = null;
                            setPlayingQueueIndex(-1);
                          }}
                          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          完了済みをクリア
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {questionQueue.map((item, idx) => {
                      const isCurrentlyPlaying = playingQueueIndex === idx && isPlaying;
                      return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                          isCurrentlyPlaying
                            ? "bg-amber-900/40 border-2 border-amber-500 shadow-lg shadow-amber-500/20"
                            : item.status === "processing"
                            ? "bg-amber-900/30 border border-amber-700"
                            : item.status === "completed"
                            ? "bg-green-900/20 border border-green-800/50 cursor-pointer hover:bg-green-900/30"
                            : item.status === "error"
                            ? "bg-red-900/20 border border-red-800/50"
                            : "bg-slate-800/50 border border-slate-700"
                        }`}
                        onClick={() => item.status === "completed" && viewQueueResult(item)}
                      >
                        {/* ステータスインジケーター */}
                        <div className="flex-shrink-0">
                          {isCurrentlyPlaying ? (
                            <div className="flex gap-0.5" title="再生中">
                              <span className="w-1 h-3 bg-amber-500 rounded animate-pulse"></span>
                              <span className="w-1 h-4 bg-amber-500 rounded animate-pulse" style={{ animationDelay: "0.1s" }}></span>
                              <span className="w-1 h-2 bg-amber-500 rounded animate-pulse" style={{ animationDelay: "0.2s" }}></span>
                            </div>
                          ) : item.status === "pending" ? (
                            <div className="w-3 h-3 rounded-full bg-slate-500" title="待機中" />
                          ) : item.status === "processing" ? (
                            <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" title="処理中" />
                          ) : item.status === "completed" ? (
                            <div className="w-3 h-3 rounded-full bg-green-500" title="完了" />
                          ) : item.status === "error" ? (
                            <div className="w-3 h-3 rounded-full bg-red-500" title="エラー" />
                          ) : null}
                        </div>

                        {/* 質問内容 */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${
                            item.status === "processing" ? "text-amber-300" :
                            item.status === "completed" ? "text-green-300" :
                            item.status === "error" ? "text-red-300" :
                            "text-slate-400"
                          }`}>
                            {item.question}
                          </p>
                          {item.status === "error" && item.error && (
                            <p className="text-xs text-red-400 truncate mt-0.5">{item.error}</p>
                          )}
                        </div>

                        {/* アクションボタン */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {item.status === "completed" && (
                            <span className="text-xs text-green-400 mr-1">クリックで表示</span>
                          )}
                          {(item.status === "pending" || item.status === "completed" || item.status === "error") && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromQueue(item.id);
                              }}
                              className="p-1 hover:bg-slate-700 rounded transition-colors"
                              title="削除"
                            >
                              <svg className="w-4 h-4 text-slate-500 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
          </div>
        )}

        {/* 履歴表示中のインジケーター */}
        {result && viewingHistoryId && (
          <div className="mb-4 w-full flex justify-end">
            <span className="text-slate-500 text-sm flex items-center gap-2">
              <span>📜</span>
              <span>履歴から表示中</span>
            </span>
          </div>
        )}


        {/* エラー表示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300 w-full">
            {error}
          </div>
        )}

        {/* フローティング音声コントロール（結果非表示時に再生中の場合） */}
        {isPlaying && !result && (
          <div className="fixed bottom-6 right-6 z-50 p-4 bg-slate-900 border border-amber-700 rounded-lg shadow-lg shadow-amber-900/20">
            <div className="flex items-center gap-3">
              <div className="flex gap-0.5">
                <span className="w-1 h-3 bg-amber-500 rounded animate-pulse"></span>
                <span className="w-1 h-4 bg-amber-500 rounded animate-pulse" style={{ animationDelay: "0.1s" }}></span>
                <span className="w-1 h-2 bg-amber-500 rounded animate-pulse" style={{ animationDelay: "0.2s" }}></span>
              </div>
              <span className="text-amber-300 text-sm">再生中</span>
              <button
                onClick={togglePlayPause}
                className="ml-2 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                title="一時停止"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* 結果表示 */}
        {result && (
          <div className="space-y-6 w-full">
            {/* 音声コントロール */}
            <div className="p-4 bg-slate-900/80 border border-slate-700 rounded-lg">
              <div className="flex items-center gap-4 flex-wrap">
                {/* 読み上げボタン */}
                <button
                  onClick={generateSpeech}
                  disabled={isPlaying}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <span>🔊</span>
                  <span>読み上げ</span>
                </button>

                {/* 再生/一時停止（再生中のみ表示） */}
                {isPlaying && (
                  <button
                    onClick={togglePlayPause}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                    title="一時停止"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  </button>
                )}

                {/* 速度スライダー */}
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-slate-400 text-sm">速度</span>
                  <span className="text-slate-300 text-sm font-medium w-10">{speechSpeed}%</span>
                  <button
                    onClick={() => setSpeechSpeed((prev) => Math.max(50, prev - 10))}
                    className="w-6 h-6 flex items-center justify-center border border-amber-500 text-amber-400 rounded hover:bg-amber-900/30 text-sm font-bold"
                  >
                    −
                  </button>
                  <input
                    type="range"
                    min="50"
                    max="200"
                    step="10"
                    value={speechSpeed}
                    onChange={(e) => setSpeechSpeed(Number(e.target.value))}
                    className="w-24 h-1.5 cursor-pointer accent-amber-500"
                  />
                  <button
                    onClick={() => setSpeechSpeed((prev) => Math.min(200, prev + 10))}
                    className="w-6 h-6 flex items-center justify-center border border-amber-500 text-amber-400 rounded hover:bg-amber-900/30 text-sm font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 再生中の表示とキュー状態 */}
              {isPlaying && (
                <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    <div className="flex gap-0.5">
                      <span className="w-1 h-3 bg-amber-500 rounded animate-pulse"></span>
                      <span className="w-1 h-4 bg-amber-500 rounded animate-pulse" style={{ animationDelay: "0.1s" }}></span>
                      <span className="w-1 h-2 bg-amber-500 rounded animate-pulse" style={{ animationDelay: "0.2s" }}></span>
                      <span className="w-1 h-5 bg-amber-500 rounded animate-pulse" style={{ animationDelay: "0.3s" }}></span>
                    </div>
                    <span>再生中...</span>
                  </div>
                  {/* キュー状態 */}
                  {queueStatus.total > 0 && (
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-green-400">{queueStatus.ready}</span>
                      </div>
                      {queueStatus.generating > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                          <span className="text-amber-400">{queueStatus.generating}</span>
                        </div>
                      )}
                      {queueStatus.pending > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                          <span className="text-slate-400">{queueStatus.pending}</span>
                        </div>
                      )}
                      <span className="text-slate-500">/ {queueStatus.total}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 質問内容 */}
            <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
              <p className="text-slate-500 text-xs mb-1">問い</p>
              <p className="text-slate-300">{question}</p>
            </div>

            {/* サマリー */}
            <div
              ref={(el) => setSectionRef("summary", el)}
              onClick={() => handleSectionClick("summary")}
              className={`p-5 bg-slate-900 border border-amber-800/50 rounded-lg transition-all duration-300 ${getHighlightStyle("summary")} ${isPlaying ? "cursor-pointer hover:ring-1 hover:ring-amber-500/50" : ""}`}
            >
              <p className="text-amber-300 text-lg">{result.summary}</p>
            </div>

            {/* 警告 */}
            {result.warning && (
              <div
                ref={(el) => setSectionRef("warning", el)}
                onClick={() => handleSectionClick("warning")}
                className={`p-4 bg-red-900/30 border border-red-800 rounded-lg transition-all duration-300 ${getHighlightStyle("warning")} ${isPlaying ? "cursor-pointer hover:ring-1 hover:ring-amber-500/50" : ""}`}
              >
                <p className="text-red-300 text-sm flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{result.warning}</span>
                </p>
              </div>
            )}

            {/* インサイト一覧 */}
            <div className="space-y-4">
              {result.insights.map((insight, index) => {
                const isExpanded = expandedInsight === insight.id;
                const titleKey = `insight-${index}-title`;
                const contentKey = `insight-${index}-content`;
                const whyNowKey = `insight-${index}-why_now`;
                const whyYouKey = `insight-${index}-why_you`;
                const actionKey = `insight-${index}-action`;
                const riskKey = `insight-${index}-risk`;
                return (
                  <div
                    key={insight.id}
                    className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden"
                  >
                    {/* タイトル部分 */}
                    <div
                      ref={(el) => setSectionRef(titleKey, el)}
                      onClick={() => {
                        if (isPlaying) {
                          handleSectionClick(titleKey);
                        } else {
                          setExpandedInsight(isExpanded ? null : insight.id);
                        }
                      }}
                      className={`p-4 cursor-pointer hover:bg-slate-800/50 transition-all duration-300 ${getHighlightStyle(titleKey)}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <span className="text-amber-400 font-bold text-lg">#{index + 1}</span>
                          <div>
                            <h3 className="font-semibold text-white">{insight.title}</h3>
                            {!isExpanded && (
                              <p className="text-slate-400 text-sm mt-1 line-clamp-2">{insight.content}</p>
                            )}
                          </div>
                        </div>
                        <svg
                          className={`w-5 h-5 text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-slate-800 pt-4 space-y-4">
                        {/* 内容 */}
                        <div
                          ref={(el) => setSectionRef(contentKey, el)}
                          onClick={() => isPlaying && handleSectionClick(contentKey)}
                          className={`p-3 rounded-lg transition-all duration-300 ${getHighlightStyle(contentKey)} ${isPlaying ? "cursor-pointer hover:ring-1 hover:ring-amber-500/50" : ""}`}
                        >
                          <p className="text-slate-300">{insight.content}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {/* なぜ今か */}
                          <div
                            ref={(el) => setSectionRef(whyNowKey, el)}
                            onClick={() => isPlaying && handleSectionClick(whyNowKey)}
                            className={`p-3 bg-slate-800/50 rounded-lg transition-all duration-300 ${getHighlightStyle(whyNowKey)} ${isPlaying ? "cursor-pointer hover:ring-1 hover:ring-amber-500/50" : ""}`}
                          >
                            <p className="text-slate-500 mb-1">なぜ今か</p>
                            <p className="text-slate-300">{insight.why_now}</p>
                          </div>
                          {/* なぜ俺か */}
                          <div
                            ref={(el) => setSectionRef(whyYouKey, el)}
                            onClick={() => isPlaying && handleSectionClick(whyYouKey)}
                            className={`p-3 bg-slate-800/50 rounded-lg transition-all duration-300 ${getHighlightStyle(whyYouKey)} ${isPlaying ? "cursor-pointer hover:ring-1 hover:ring-amber-500/50" : ""}`}
                          >
                            <p className="text-slate-500 mb-1">なぜ俺か</p>
                            <p className="text-slate-300">{insight.why_you}</p>
                          </div>
                        </div>

                        {/* 次の一手 */}
                        <div
                          ref={(el) => setSectionRef(actionKey, el)}
                          onClick={() => isPlaying && handleSectionClick(actionKey)}
                          className={`p-3 bg-amber-900/20 border border-amber-800/50 rounded-lg transition-all duration-300 ${getHighlightStyle(actionKey)} ${isPlaying ? "cursor-pointer hover:ring-1 hover:ring-amber-500/50" : ""}`}
                        >
                          <p className="text-amber-400 text-sm mb-1">次の一手</p>
                          <p className="text-white">{insight.action}</p>
                        </div>

                        {/* リスク */}
                        {insight.risk && (
                          <div
                            ref={(el) => setSectionRef(riskKey, el)}
                            onClick={() => isPlaying && handleSectionClick(riskKey)}
                            className={`p-3 bg-red-900/20 border border-red-800/50 rounded-lg transition-all duration-300 ${getHighlightStyle(riskKey)} ${isPlaying ? "cursor-pointer hover:ring-1 hover:ring-amber-500/50" : ""}`}
                          >
                            <p className="text-red-400 text-sm mb-1">リスク・盲点</p>
                            <p className="text-slate-300">{insight.risk}</p>
                          </div>
                        )}

                        {/* LifeValue影響 */}
                        <div className="flex flex-wrap gap-3 pt-2">
                          <div className={`flex items-center gap-1 text-sm ${getImpactColor(insight.lifevalue_impact.reward)}`}>
                            <span>{getImpactIcon(insight.lifevalue_impact.reward)}</span>
                            <span>報酬系</span>
                          </div>
                          <div className={`flex items-center gap-1 text-sm ${getImpactColor(insight.lifevalue_impact.freedom)}`}>
                            <span>{getImpactIcon(insight.lifevalue_impact.freedom)}</span>
                            <span>Freedom</span>
                          </div>
                          <div className={`flex items-center gap-1 text-sm ${getImpactColor(insight.lifevalue_impact.stress)}`}>
                            <span>{getImpactIcon(insight.lifevalue_impact.stress)}</span>
                            <span>Stress</span>
                          </div>
                          <div className={`flex items-center gap-1 text-sm ${getImpactColor(insight.lifevalue_impact.meaning)}`}>
                            <span>{getImpactIcon(insight.lifevalue_impact.meaning)}</span>
                            <span>Meaning</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 空の状態 */}
        {!result && !loading && !error && questionQueue.length === 0 && (
          <div className="text-center py-8 w-full">
            <p className="text-slate-500 text-lg">問いを投げかけてください</p>
            <p className="text-slate-600 text-sm mt-2">
              会社の文脈 × あなたの人格OS → あなた専用のナビゲーション
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
