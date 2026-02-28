// ボトルネックファインダー AIプロンプト

import type { BottleneckNode, BottleneckEdge } from "./bottleneck-types";

// ステージ1: ドキュメントから業務フローを抽出
export function buildFlowExtractionPrompt(documentContents: string): string {
  return `あなたは業務プロセス分析（BPM/BPMN）の専門家です。

## タスク
以下のドキュメントから業務フロー（ワークフロー）を抽出し、**現実の業務を忠実に反映した2次元フローチャート**を生成してください。
単純な一直線のフローではなく、実際の業務で発生する分岐・差し戻し・並行処理・部門間の連携を可視化することが最重要です。

## ドキュメント内容
${documentContents}

## 出力形式
必ず以下のJSON形式で回答してください：
{
  "nodes": [
    {
      "id": "node1",
      "label": "ステップ名（短く）",
      "type": "manual|automated|semi-automated",
      "description": "このステップの詳細説明",
      "actor": "担当者/部門名",
      "tool": "使用ツール/システム名",
      "estimatedTime": "所要時間の目安",
      "severity": "none",
      "automationPotential": 1,
      "issues": [],
      "suggestions": []
    }
  ],
  "edges": [
    {
      "from": "node1",
      "to": "node2",
      "label": "接続ラベル（任意）",
      "condition": "条件分岐の場合の条件（任意）"
    }
  ],
  "mermaidCode": "（下記のMermaid設計ルールに従って生成）"
}

## Mermaidフローチャート設計ルール（最重要）

### 1. レイアウト: graph TD（上→下）を基本とする
上から下へ流れる縦型レイアウトにし、部門（アクター）をsubgraphで**横に並べて**スイムレーン風にする。
これにより、どの部門が何をしているかが一目で分かる2次元の図になる。
縦方向にフローが進むため、一画面に収まりやすい。

### 2. subgraphで部門/アクターを分離する
\`\`\`
graph TD
  subgraph 申請者
    a1[経費入力] --> a2[領収書添付]
  end
  subgraph 上長
    b1{承認?}
  end
  subgraph 経理部
    c1[書類確認] --> c2[仕訳入力]
  end
  a2 --> b1
  b1 -->|承認| c1
  b1 -->|差し戻し| a1
\`\`\`

### 3. 必ず含めるべきフロー要素
- **判断ノード（菱形 {}）**: 承認/却下、OK/NG、条件分岐は必ず菱形で表現
- **差し戻し・修正ループ**: 却下→前のステップに戻る矢印（これが最重要。現実の業務は差し戻しだらけ）
- **並行処理**: 同時に進行するステップがあれば並列に配置
- **部門間の受け渡し**: subgraph をまたぐ矢印で部門間連携を可視化
- **開始/終了**: 丸ノード (( )) で開始と終了を明示

### 4. ノード形状
- 手動作業: [ステップ名]（角括弧）
- 自動処理: ([ステップ名])（丸括弧+角括弧=スタジアム形）
- 半自動: [[ステップ名]]（二重角括弧=サブルーチン形）
- 判断分岐: {条件?}（菱形）
- 開始/終了: ((開始)) / ((完了))（二重丸）

### 5. エッジラベル
- 条件分岐の出力には必ずラベルを付ける: -->|承認| / -->|差し戻し| / -->|OK| / -->|NG|
- 部門間の受け渡しにもラベル推奨: -->|メール送付| / -->|システム連携|

### 6. 禁止事項
- **一直線（ノード→ノード→ノード→...の1次元チェーン）は絶対禁止**
- subgraph無しのフラットな図は禁止
- 差し戻し・分岐が1つもないフローは現実的でないので禁止（最低2つ以上の分岐を含めること）

## ノードのID命名規則
部門ごとにプレフィックスを付ける: app_1, app_2（申請者）、mgr_1（上長）、acc_1, acc_2（経理）等

## その他の指示
- severity（深刻度）はこの段階ではすべて "none" に設定
- automationPotential（自動化ポテンシャル）は1に設定
- ドキュメントに明示されていなくても、業務の常識として存在する差し戻し・確認・例外処理は補完して含めること`;
}

// ステージ2: フローのボトルネック分析
export function buildBottleneckAnalysisPrompt(
  nodes: BottleneckNode[],
  edges: BottleneckEdge[]
): string {
  return `あなたは業務プロセス改善の専門家です。

## タスク
以下の業務フローを分析し、各ステップのボトルネック度と自動化ポテンシャルを評価してください。

## 業務フロー
### ノード一覧
${JSON.stringify(nodes, null, 2)}

### 接続関係
${JSON.stringify(edges, null, 2)}

## 出力形式
必ず以下のJSON形式で回答してください：
{
  "analyzedNodes": [
    {
      "id": "元のノードID",
      "severity": "critical|high|medium|low|none",
      "automationPotential": 1-5,
      "issues": ["問題点1", "問題点2"],
      "suggestions": ["改善提案1", "改善提案2"]
    }
  ]
}

## 評価基準

### severity（ボトルネックの深刻度）
- **critical**: 業務全体を停滞させる重大なボトルネック（手動処理に1日以上、エラー頻発）
- **high**: 大きな非効率を生んでいる（手動処理に数時間、属人化）
- **medium**: 改善の余地がある（部分的な手動処理、効率化可能）
- **low**: 軽微な非効率（ほぼ自動化済みだが微調整可能）
- **none**: ボトルネックなし（完全自動化済み or 最適化済み）

### automationPotential（自動化ポテンシャル）1-5
- **5**: すぐにRPA/APIで完全自動化可能
- **4**: 少しのカスタマイズで自動化可能
- **3**: 一部は自動化可能、一部は人間の判断が必要
- **2**: 限定的な自動化のみ可能
- **1**: 自動化困難（高度な判断・創造性が必要）

## 重要な指示
1. 手動(manual)ステップを重点的に評価すること
2. 全ノードについて評価結果を返すこと（automated ステップも severity: none で返す）
3. 具体的かつ実用的な issues と suggestions を記載すること`;
}

// ステージ3: レポート生成
export function buildReportPrompt(
  nodes: BottleneckNode[],
  edges: BottleneckEdge[]
): string {
  const manualNodes = nodes.filter(n => n.type === "manual");
  const automatedNodes = nodes.filter(n => n.type === "automated");
  const semiAutomatedNodes = nodes.filter(n => n.type === "semi-automated");
  const criticalNodes = nodes.filter(n => n.severity === "critical" || n.severity === "high");

  return `あなたは業務改善コンサルタントです。

## タスク
以下の業務フロー分析結果に基づき、構造化レポートを生成してください。

## フロー概要
- 総ステップ数: ${nodes.length}
- 手動ステップ: ${manualNodes.length}
- 自動ステップ: ${automatedNodes.length}
- 半自動ステップ: ${semiAutomatedNodes.length}
- 自動化率: ${nodes.length > 0 ? Math.round((automatedNodes.length / nodes.length) * 100) : 0}%
- 重大ボトルネック: ${criticalNodes.length}件

## ノード詳細
${JSON.stringify(nodes, null, 2)}

## 接続関係
${JSON.stringify(edges, null, 2)}

## 出力形式
必ず以下のJSON形式で回答してください：
{
  "executiveSummary": "エグゼクティブサマリー（3-5文で業務全体の課題と改善方針を要約）",
  "solutions": [
    {
      "id": "sol1",
      "title": "解決策名",
      "description": "解決策の詳細説明",
      "targetNodeIds": ["改善対象のノードID"],
      "toolCategory": "RPA|API|SaaS|AI|workflow|other",
      "implementationEffort": "low|medium|high",
      "expectedImpact": "low|medium|high",
      "estimatedCost": "概算コスト",
      "estimatedTimeline": "導入目安期間",
      "priority": 1-5
    }
  ],
  "priorityMatrix": [
    {
      "solutionId": "sol1",
      "title": "解決策名",
      "impact": 1-5,
      "effort": 1-5,
      "quadrant": "quick-win|strategic|fill-in|thankless"
    }
  ]
}

## 重要な指示
1. solutions は具体的な改善施策を5-10件提案すること
2. toolCategoryは最も適した自動化手法を選択すること
3. priorityMatrixのquadrant判定:
   - quick-win: impact高 & effort低（すぐやるべき）
   - strategic: impact高 & effort高（計画的に実施）
   - fill-in: impact低 & effort低（余裕があれば）
   - thankless: impact低 & effort高（避けるべき）
4. 実行可能で具体的な提案のみ行うこと`;
}

// ステージ4: After（改善後）フロー生成
export function buildAfterFlowPrompt(
  nodes: BottleneckNode[],
  edges: BottleneckEdge[],
  mermaidCodeBefore: string,
  solutions: { title: string; targetNodeIds: string[]; toolCategory: string }[]
): string {
  return `あなたは業務プロセス改善（BPR）の専門家です。

## タスク
以下の「現状フロー（Before）」と「解決策」を基に、**改善後フロー（After）**のMermaidコードを生成してください。
Beforeとの差分が一目でわかる図にしてください。

## 現状フロー（Before）
### ノード
${JSON.stringify(nodes.map(n => ({ id: n.id, label: n.label, type: n.type, actor: n.actor, severity: n.severity })), null, 2)}

### Mermaidコード
${mermaidCodeBefore}

## 解決策一覧
${solutions.map((s, i) => `${i + 1}. ${s.title} [${s.toolCategory}] → 対象: ${s.targetNodeIds.join(", ")}`).join("\n")}

## 出力形式
必ず以下のJSON形式で回答してください：
{
  "mermaidCode": "graph TD\\n  ...",
  "changes": [
    {
      "beforeNodeId": "元のノードID",
      "change": "eliminated|automated|simplified|merged|added",
      "description": "何がどう変わったか"
    }
  ],
  "summary": "改善の全体像を2-3文で"
}

## Afterフロー設計ルール
1. **graph TD** で上→下レイアウト。subgraphで部門分離（Beforeと同じ構造）
2. **自動化されたステップ**: ([ステップ名])（スタジアム形）に変更し、緑系スタイル(fill:#22c55e)を適用
3. **削除されたステップ**: フローから除去（例: 手動スキャン→アプリ撮影で置き換え）
4. **統合されたステップ**: 複数ノードを1つにまとめる
5. **新規追加**: システム連携など新しいノードを追加してよい
6. **差し戻しループの削減**: バリデーション自動化で差し戻し発生を減らす（ループ自体は残すが、ラベルで「発生率低下」等を示す）
7. 自動化ノードには style で fill:#22c55e,stroke:#16a34a,color:#fff を適用
8. 半自動ノードには style で fill:#3b82f6,stroke:#2563eb,color:#fff を適用
9. 手動のまま残るノードには style で fill:#f97316,stroke:#ea580c,color:#fff を適用`;
}

// Mermaidコードを色分け付きで更新
export function addSeverityColoring(mermaidCode: string, nodes: BottleneckNode[]): string {
  const styleLines: string[] = [];

  for (const node of nodes) {
    switch (node.severity) {
      case "critical":
        styleLines.push(`  style ${node.id} fill:#ef4444,stroke:#dc2626,color:#fff`);
        break;
      case "high":
        styleLines.push(`  style ${node.id} fill:#f97316,stroke:#ea580c,color:#fff`);
        break;
      case "medium":
        styleLines.push(`  style ${node.id} fill:#eab308,stroke:#ca8a04,color:#000`);
        break;
      case "low":
        styleLines.push(`  style ${node.id} fill:#84cc16,stroke:#65a30d,color:#000`);
        break;
      case "none":
        if (node.type === "automated") {
          styleLines.push(`  style ${node.id} fill:#22c55e,stroke:#16a34a,color:#fff`);
        }
        break;
    }
  }

  if (styleLines.length === 0) return mermaidCode;
  return mermaidCode + "\n" + styleLines.join("\n");
}

// Mermaidコードのサニタイズ（AIが生成する構文エラーを修正）
export function sanitizeMermaidCode(code: string): string {
  return code
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      // style行やコメント行はスキップ
      if (trimmed.startsWith("style ") || trimmed.startsWith("%%")) return line;

      // subgraph名の括弧を除去（全角・半角両方）
      if (/^\s*subgraph\s+/.test(line)) {
        return line
          .replace(/[（(][^）)]*[）)]/g, "")
          .replace(/\s+$/, "");
      }

      // ノードラベル [テキスト] 内の半角括弧を全角に変換
      // (( )) はMermaid構文なので保持、[] {} 内の () を変換
      let result = line;
      result = result.replace(/\[([^\]]*)\]/g, (match, content) => {
        return "[" + content.replace(/\(/g, "（").replace(/\)/g, "）") + "]";
      });

      // エッジラベル |...| 内の括弧を除去
      result = result.replace(/\|([^|]*)\|/g, (match, label) => {
        return "|" + label.replace(/[（()）]/g, "").replace(/\s+/g, " ").trim() + "|";
      });

      return result;
    })
    .join("\n");
}
