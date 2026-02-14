/**
 * マルチモーダル報告書ドラフター - サンプルデータ定義
 * 商船三井マリテックスの実務に即した5パターン
 */

import type { FileCategory } from "@/lib/file-utils";

export interface SampleMaterial {
  fileName: string;
  fileType: FileCategory;
  memo: string;
  textContent?: string;
  base64?: string;
  mimeType?: string;
  fileSize: number;
}

export interface SamplePattern {
  id: string;
  label: string;
  icon: string;
  description: string;
  reportTitle: string;
  additionalInstructions: string;
  stockQuery: string;
  /** Canvas画像生成関数群（ブラウザでのみ実行） */
  generateImages: () => { fileName: string; base64: string; memo: string }[];
  /** テキスト素材 */
  materials: SampleMaterial[];
}

// ============================================================
// Canvas画像生成ヘルパー
// ============================================================

function createCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext("2d")! };
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, bg: string, border: string) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = border;
  ctx.strokeRect(0, 0, w, h);
}

function drawTitle(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.font = "bold 15px sans-serif";
  ctx.fillText(text, x, y);
}

function drawBarChart(
  ctx: CanvasRenderingContext2D,
  data: { label: string; value: number; color: string }[],
  opts: { x: number; y: number; w: number; h: number; maxValue: number; unit?: string }
) {
  const { x: ox, y: oy, w, h, maxValue, unit = "" } = opts;
  const barW = Math.floor((w - 20) / data.length) - 8;
  const startX = ox + 10;

  // グリッド
  ctx.strokeStyle = "#e2e8f0";
  for (let v = 0; v <= maxValue; v += Math.ceil(maxValue / 5)) {
    const yy = oy + h - (v / maxValue) * h;
    ctx.beginPath();
    ctx.moveTo(ox, yy);
    ctx.lineTo(ox + w, yy);
    ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${v}${unit}`, ox - 4, yy + 4);
  }
  ctx.textAlign = "left";

  data.forEach((d, i) => {
    const xx = startX + i * (barW + 8);
    const barH = (d.value / maxValue) * h;
    const yy = oy + h - barH;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.roundRect(xx, yy, barW, barH, [3, 3, 0, 0]);
    ctx.fill();
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${d.value}`, xx + barW / 2, yy - 4);
    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.fillText(d.label, xx + barW / 2, oy + h + 14);
  });
  ctx.textAlign = "left";
}

function drawStatusBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  title: string, status: string, statusColor: string, details: string[]
) {
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = statusColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1;

  ctx.fillStyle = statusColor;
  ctx.beginPath();
  ctx.roundRect(x + w - 58, y + 8, 50, 18, 9);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(status, x + w - 33, y + 21);
  ctx.textAlign = "left";

  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText(title, x + 10, y + 22);

  ctx.fillStyle = "#475569";
  ctx.font = "11px sans-serif";
  details.forEach((d, i) => ctx.fillText(d, x + 10, y + 40 + i * 15));
}

function drawLineChart(
  ctx: CanvasRenderingContext2D,
  series: { label: string; color: string; data: number[] }[],
  labels: string[],
  opts: { x: number; y: number; w: number; h: number; maxValue: number; unit?: string }
) {
  const { x: ox, y: oy, w, h, maxValue, unit = "" } = opts;
  const step = w / (labels.length - 1);

  // グリッド
  ctx.strokeStyle = "#e2e8f0";
  for (let v = 0; v <= maxValue; v += Math.ceil(maxValue / 4)) {
    const yy = oy + h - (v / maxValue) * h;
    ctx.beginPath();
    ctx.moveTo(ox, yy);
    ctx.lineTo(ox + w, yy);
    ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${v}${unit}`, ox - 4, yy + 4);
  }
  ctx.textAlign = "left";

  // ラベル
  labels.forEach((l, i) => {
    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(l, ox + i * step, oy + h + 14);
  });
  ctx.textAlign = "left";

  // ライン描画
  series.forEach((s) => {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    s.data.forEach((v, i) => {
      const xx = ox + i * step;
      const yy = oy + h - (v / maxValue) * h;
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    });
    ctx.stroke();
    // ドット
    s.data.forEach((v, i) => {
      const xx = ox + i * step;
      const yy = oy + h - (v / maxValue) * h;
      ctx.beginPath();
      ctx.arc(xx, yy, 3, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
    });
    ctx.lineWidth = 1;
  });
}

function drawPieChart(
  ctx: CanvasRenderingContext2D,
  data: { label: string; value: number; color: string }[],
  cx: number, cy: number, r: number
) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let startAngle = -Math.PI / 2;

  data.forEach((d) => {
    const sweep = (d.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + sweep);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineWidth = 1;

    // ラベル
    const mid = startAngle + sweep / 2;
    const lx = cx + Math.cos(mid) * (r * 0.65);
    const ly = cy + Math.sin(mid) * (r * 0.65);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.round(d.value / total * 100)}%`, lx, ly + 4);
    ctx.textAlign = "left";

    startAngle += sweep;
  });
}


// ============================================================
// パターン1: 船舶点検業務報告書
// ============================================================

const pattern1: SamplePattern = {
  id: "ship-inspection",
  label: "船舶点検報告",
  icon: "🔧",
  description: "船舶の定期点検結果をまとめた業務報告書",
  reportTitle: "2026年1月度 船舶点検業務報告書",
  additionalInstructions: "各セクションに所見と改善提案を含めてください。",
  stockQuery: "cargo ship engine room",
  generateImages: () => {
    // 点検合格率グラフ
    const { canvas: c1, ctx: ctx1 } = createCanvas(480, 320);
    drawBackground(ctx1, 480, 320, "#f8fafc", "#e2e8f0");
    drawTitle(ctx1, "月別 点検合格率 (%)", 130, 26, "#1e293b");
    // 基準線
    ctx1.strokeStyle = "#ef444480";
    ctx1.setLineDash([6, 4]);
    ctx1.beginPath();
    const bl = 280 - (90 * 2.2);
    ctx1.moveTo(60, bl);
    ctx1.lineTo(460, bl);
    ctx1.stroke();
    ctx1.setLineDash([]);
    ctx1.fillStyle = "#ef4444";
    ctx1.font = "11px sans-serif";
    ctx1.fillText("基準 90%", 6, bl + 4);
    drawBarChart(ctx1, [
      { label: "8月", value: 85, color: "#f59e0b" },
      { label: "9月", value: 92, color: "#22c55e" },
      { label: "10月", value: 78, color: "#ef4444" },
      { label: "11月", value: 95, color: "#22c55e" },
      { label: "12月", value: 88, color: "#f59e0b" },
      { label: "1月", value: 97, color: "#22c55e" },
    ], { x: 60, y: 40, w: 400, h: 240, maxValue: 100, unit: "%" });
    const img1 = c1.toDataURL("image/png");

    // 設備稼働状況サマリー
    const { canvas: c2, ctx: ctx2 } = createCanvas(480, 360);
    drawBackground(ctx2, 480, 360, "#f0f9ff", "#bae6fd");
    drawTitle(ctx2, "船舶設備 稼働状況サマリー (2026年1月)", 80, 26, "#0c4a6e");
    drawStatusBox(ctx2, 16, 40, 215, 95, "主機関", "正常", "#22c55e", ["出力: 97.2%", "振動: 正常範囲内", "排気温度: 均一"]);
    drawStatusBox(ctx2, 248, 40, 215, 95, "発電機・補機", "正常", "#22c55e", ["絶縁抵抗: 3.5MΩ", "補機振動: 1.8mm/s", "冷凍機: 4.3bar"]);
    drawStatusBox(ctx2, 16, 150, 215, 95, "バラストポンプ", "要整備", "#ef4444", ["No.2 流量: 480m3/h", "基準: 500m3/h → NG", "2月分解整備予定"]);
    drawStatusBox(ctx2, 248, 150, 215, 95, "操舵・航海機器", "正常", "#22c55e", ["舵取機油圧: 162bar", "GPS・レーダー正常"]);
    drawStatusBox(ctx2, 16, 260, 215, 90, "安全・救命設備", "確認済", "#3b82f6", ["救命いかだ: 全数OK", "CO2消火装置: 基準内"]);
    drawStatusBox(ctx2, 248, 260, 215, 90, "甲板・船体", "注意", "#f59e0b", ["係船ワイヤー 摩耗あり", "右舷船首 塗装劣化"]);
    const img2 = c2.toDataURL("image/png");

    return [
      { fileName: "月別点検合格率グラフ.png", base64: img1, memo: "直近6ヶ月の点検合格率の推移" },
      { fileName: "設備稼働状況サマリー.png", base64: img2, memo: "各設備の稼働状態を一覧化" },
    ];
  },
  materials: [
    {
      fileName: "点検チェックリスト.xlsx",
      fileType: "spreadsheet",
      memo: "1月度の定期点検結果",
      fileSize: 24500,
      textContent: `### シート: 点検結果

| 点検項目 | 基準値 | 実測値 | 判定 | 備考 |
| --- | --- | --- | --- | --- |
| 主機関 出力 | 95%以上 | 97.2% | OK | 良好 |
| 補機 振動値 | 2.0mm/s以下 | 1.8mm/s | OK |  |
| 発電機 絶縁抵抗 | 1MΩ以上 | 3.5MΩ | OK |  |
| 舵取機 油圧 | 150-170bar | 162bar | OK |  |
| バラストポンプ 流量 | 500m3/h以上 | 480m3/h | NG | 要整備 |
| 冷凍機 冷媒圧力 | 4.0-5.0bar | 4.3bar | OK |  |
| 救命設備 点検 | - | - | OK | 全数確認済 |
| 消火設備 点検 | - | - | OK | CO2ボンベ重量確認済 |`,
    },
    {
      fileName: "現場写真メモ.txt",
      fileType: "document",
      memo: "点検時の現場記録",
      fileSize: 1200,
      textContent: `2026年1月15日 定期点検メモ

■ 主機関室
- 主機関の運転状態は良好。異常振動・異音なし。
- 排気温度は各シリンダー間で均一（偏差5℃以内）。
- 潤滑油の色・粘度に異常なし。次回交換は3月予定。

■ 甲板部
- 係船設備のワイヤーロープ2本に摩耗あり。次回入港時に交換推奨。
- 塗装の劣化が右舷船首付近で確認。タッチアップ要。

■ バラストポンプ
- No.2バラストポンプの流量が基準値を下回っている（480m3/h）。
- インペラーの摩耗が原因と推定。
- 2月中の分解整備を推奨。部品手配済み。

■ 安全設備
- 救命いかだ、救命胴衣の点検完了。有効期限内を確認。
- CO2消火装置のボンベ重量測定完了。全数基準内。`,
    },
    {
      fileName: "チーフエンジニアインタビュー.webm",
      fileType: "audio",
      memo: "チーフエンジニアへのインタビュー",
      fileSize: 3500000,
      textContent: `チーフエンジニアの田中です。1月の点検結果について報告します。
全体としては良好な状態を維持しています。主機関については前回の整備後、非常に安定した運転が続いています。
一つ懸念事項として、No.2バラストポンプの流量低下があります。これはインペラーの経年摩耗が原因と考えられます。2月の入港時に分解整備を行う予定で、既に交換部品の手配は完了しています。
また、甲板部の係船ワイヤーについても2本の交換が必要です。安全に関わる部分ですので、こちらも次回入港時に対応します。
その他、特記事項はありません。船体の状態は年式を考慮しても良好な部類に入ると考えています。`,
    },
    {
      fileName: "燃料消費レポート.csv",
      fileType: "spreadsheet",
      memo: "燃料消費量の月次推移",
      fileSize: 890,
      textContent: `| 月 | HFO消費量(MT) | MDO消費量(MT) | 航行距離(nm) | 燃費(MT/1000nm) |
| --- | --- | --- | --- | --- |
| 2025/08 | 245.3 | 12.1 | 4520 | 56.9 |
| 2025/09 | 231.8 | 11.5 | 4310 | 56.4 |
| 2025/10 | 258.7 | 13.2 | 4680 | 58.1 |
| 2025/11 | 242.1 | 11.8 | 4450 | 57.1 |
| 2025/12 | 249.5 | 12.4 | 4550 | 57.6 |
| 2026/01 | 238.9 | 11.9 | 4380 | 57.2 |`,
    },
  ],
};


// ============================================================
// パターン2: 洋上風力プロジェクト進捗報告書
// ============================================================

const pattern2: SamplePattern = {
  id: "offshore-wind",
  label: "洋上風力進捗",
  icon: "🌊",
  description: "洋上風力発電プロジェクトの月次進捗報告",
  reportTitle: "秋田沖洋上風力発電 支援業務 月次進捗報告書（2026年1月）",
  additionalInstructions: "安全管理状況とスケジュール遵守率を重点的にまとめてください。HSE（安全・健康・環境）の観点を必ず含めること。",
  stockQuery: "offshore wind turbine sea",
  generateImages: () => {
    // 工程進捗ガントチャート風
    const { canvas: c1, ctx: ctx1 } = createCanvas(520, 320);
    drawBackground(ctx1, 520, 320, "#f8fafc", "#e2e8f0");
    drawTitle(ctx1, "工程進捗状況（2026年1月末時点）", 120, 24, "#1e293b");

    const tasks = [
      { name: "海底地盤調査", plan: 100, actual: 100, color: "#22c55e" },
      { name: "基礎杭製造", plan: 80, actual: 75, color: "#f59e0b" },
      { name: "海上輸送準備", plan: 60, actual: 62, color: "#22c55e" },
      { name: "SEP船配船調整", plan: 45, actual: 40, color: "#f59e0b" },
      { name: "タービン据付", plan: 20, actual: 15, color: "#ef4444" },
      { name: "海底ケーブル敷設", plan: 10, actual: 8, color: "#f59e0b" },
      { name: "系統連系・試運転", plan: 0, actual: 0, color: "#94a3b8" },
    ];

    const barY = 45;
    const barH = 32;
    const nameW = 130;
    const chartW = 340;
    const chartX = 160;

    // グリッド
    for (let p = 0; p <= 100; p += 25) {
      const x = chartX + (p / 100) * chartW;
      ctx1.strokeStyle = "#e2e8f0";
      ctx1.beginPath();
      ctx1.moveTo(x, barY);
      ctx1.lineTo(x, barY + tasks.length * (barH + 6));
      ctx1.stroke();
      ctx1.fillStyle = "#94a3b8";
      ctx1.font = "10px sans-serif";
      ctx1.textAlign = "center";
      ctx1.fillText(`${p}%`, x, barY - 4);
    }
    ctx1.textAlign = "left";

    tasks.forEach((t, i) => {
      const y = barY + i * (barH + 6);
      // タスク名
      ctx1.fillStyle = "#334155";
      ctx1.font = "11px sans-serif";
      ctx1.fillText(t.name, 12, y + barH / 2 + 4);
      // 計画バー
      const planW = (t.plan / 100) * chartW;
      ctx1.fillStyle = "#e2e8f0";
      ctx1.beginPath();
      ctx1.roundRect(chartX, y, planW || 1, barH / 2 - 1, 3);
      ctx1.fill();
      // 実績バー
      const actW = (t.actual / 100) * chartW;
      ctx1.fillStyle = t.color;
      ctx1.beginPath();
      ctx1.roundRect(chartX, y + barH / 2 + 1, actW || 1, barH / 2 - 1, 3);
      ctx1.fill();
      // 数値
      ctx1.fillStyle = "#1e293b";
      ctx1.font = "bold 10px sans-serif";
      if (t.actual > 0) {
        ctx1.fillText(`${t.actual}%`, chartX + actW + 4, y + barH - 2);
      }
    });

    // 凡例
    ctx1.font = "10px sans-serif";
    ctx1.fillStyle = "#e2e8f0";
    ctx1.fillRect(160, 300, 30, 8);
    ctx1.fillStyle = "#475569";
    ctx1.fillText("計画", 194, 308);
    ctx1.fillStyle = "#3b82f6";
    ctx1.fillRect(240, 300, 30, 8);
    ctx1.fillStyle = "#475569";
    ctx1.fillText("実績", 274, 308);

    const img1 = c1.toDataURL("image/png");

    // 安全管理指標
    const { canvas: c2, ctx: ctx2 } = createCanvas(480, 280);
    drawBackground(ctx2, 480, 280, "#f0fdf4", "#bbf7d0");
    drawTitle(ctx2, "HSE指標サマリー（2026年1月）", 120, 24, "#14532d");

    const hseData = [
      { label: "LTI\n(休業災害)", value: "0件", color: "#22c55e", sub: "累計0件" },
      { label: "TRI\n(記録災害)", value: "0件", color: "#22c55e", sub: "累計0件" },
      { label: "ニアミス\n報告", value: "3件", color: "#f59e0b", sub: "対策完了2件" },
      { label: "安全\nパトロール", value: "12回", color: "#3b82f6", sub: "計画比100%" },
      { label: "KY活動\n実施率", value: "100%", color: "#22c55e", sub: "全日実施" },
    ];

    hseData.forEach((d, i) => {
      const x = 20 + i * 92;
      ctx2.fillStyle = "#ffffff";
      ctx2.strokeStyle = d.color;
      ctx2.lineWidth = 2;
      ctx2.beginPath();
      ctx2.roundRect(x, 44, 82, 120, 8);
      ctx2.fill();
      ctx2.stroke();
      ctx2.lineWidth = 1;

      ctx2.fillStyle = d.color;
      ctx2.font = "bold 24px sans-serif";
      ctx2.textAlign = "center";
      ctx2.fillText(d.value, x + 41, 100);

      ctx2.fillStyle = "#334155";
      ctx2.font = "10px sans-serif";
      const lines = d.label.split("\n");
      lines.forEach((l, li) => ctx2.fillText(l, x + 41, 120 + li * 14));

      ctx2.fillStyle = "#64748b";
      ctx2.font = "9px sans-serif";
      ctx2.fillText(d.sub, x + 41, 155);
      ctx2.textAlign = "left";
    });

    // 無災害日数
    ctx2.fillStyle = "#14532d";
    ctx2.font = "bold 14px sans-serif";
    ctx2.textAlign = "center";
    ctx2.fillText("プロジェクト無災害記録: 連続 287日", 240, 200);

    // 安全スローガン
    ctx2.fillStyle = "#166534";
    ctx2.font = "12px sans-serif";
    ctx2.fillText("月間安全スローガン:「確認の一手間が 安全の第一歩」", 240, 230);
    ctx2.textAlign = "left";

    const img2 = c2.toDataURL("image/png");

    return [
      { fileName: "工程進捗チャート.png", base64: img1, memo: "各工程の計画vs実績進捗" },
      { fileName: "HSE安全指標サマリー.png", base64: img2, memo: "安全管理KPIの一覧" },
    ];
  },
  materials: [
    {
      fileName: "作業実績一覧.xlsx",
      fileType: "spreadsheet",
      memo: "1月の海上作業実績",
      fileSize: 31200,
      textContent: `### シート: 1月作業実績

| 作業日 | 作業内容 | 使用船舶 | 天候 | 海象 | 作業時間 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| 1/6 | 基礎杭打設 #12 | SEP船「海翼」 | 晴 | 波高0.8m | 8h | 予定通り完了 |
| 1/7 | 基礎杭打設 #13 | SEP船「海翼」 | 曇 | 波高1.2m | 10h | 1h遅延（地盤硬質） |
| 1/8-9 | 荒天待機 | - | 雪/暴風 | 波高3.5m | - | 低気圧通過のため |
| 1/10 | 基礎杭打設 #14 | SEP船「海翼」 | 晴 | 波高0.6m | 7.5h | 良好 |
| 1/13-14 | TP（トランジションピース）据付 #10-11 | クレーン船 | 晴/曇 | 波高0.9m | 16h | 2基連続施工 |
| 1/15 | 海底ケーブルルート調査 | 調査船「みらい」 | 曇 | 波高1.0m | 6h | ROV使用 |
| 1/20-22 | タービンタワー輸送 | バージ船 | 晴 | 波高0.7m | - | 港湾→サイト |
| 1/27 | 海底ケーブル敷設（区間A） | ケーブル船 | 晴 | 波高0.5m | 12h | 2.3km敷設完了 |`,
    },
    {
      fileName: "プロジェクト会議議事メモ.txt",
      fileType: "document",
      memo: "週次プロジェクト会議の記録",
      fileSize: 2100,
      textContent: `秋田沖洋上風力 プロジェクト週次会議メモ（1/27実施）

■ 参加者: 佐藤PM、鈴木副PM、田中安全管理者、山田海上施工監督、クライアント（東北電力・鹿島JV）

■ 進捗
- 基礎杭打設: 14/20本完了（70%）。1月は3本施工。荒天により2日のロスあり。
- TP据付: 11/20基完了（55%）。
- タービン据付: 3/20基完了（15%）。2月に4基の据付を予定。
- ケーブル敷設: 区間A完了（2.3km）。全長12km中、進捗約8%。

■ 課題
1. 2月は荒天日が増える見込み。ウェザーウィンドウの確保が課題。
2. SEP船の次回メンテナンス（3月予定）前に杭打設を完了させたい。
3. タービンメーカー（Vestas）から部品納期に2週間遅延の連絡あり。工程影響を精査中。

■ HSE報告
- 1月のLTI/TRI: ゼロ。ニアミス3件（玉掛け作業、高所作業、船上移動）。
- いずれも原因分析→対策実施済み。水平展開完了。

■ 次月計画
- 基礎杭: 残6本の打設完了を目指す。
- タービン据付: 4基（#4, #5, #6, #7）。
- ケーブル: 区間B敷設開始。`,
    },
    {
      fileName: "安全管理者ブリーフィング.webm",
      fileType: "audio",
      memo: "安全管理者による月次安全総括",
      fileSize: 2800000,
      textContent: `安全管理者の田中です。1月の安全管理状況について報告します。
まず、今月もLTI・TRIともにゼロを達成しました。プロジェクト開始からの無災害記録は287日に達しています。
ニアミスは3件の報告がありました。1件目は玉掛け作業中のワイヤー接触ニアミスです。作業手順の再確認と、合図者の配置見直しを行いました。2件目は高所作業中のハーネス接続忘れのヒヤリハットで、作業前のバディチェック制度を導入しました。3件目は荒天後のデッキ移動時の転倒リスクで、滑り止めマットの追加設置で対策済みです。
安全パトロールは計画通り12回実施し、軽微な指摘8件はすべて即日対応完了しています。
来月は冬季の荒天が増える時期ですので、乗下船時の安全確保と船上での転倒防止に重点を置いた活動を行います。`,
    },
    {
      fileName: "気象データ1月.csv",
      fileType: "spreadsheet",
      memo: "秋田沖の1月気象・海象データ",
      fileSize: 650,
      textContent: `| 週 | 稼働可能日数 | 荒天待機日数 | 平均波高(m) | 最大風速(m/s) | 稼働率 |
| --- | --- | --- | --- | --- | --- |
| 第1週(1/1-5) | 3 | 2 | 1.4 | 18.5 | 60% |
| 第2週(1/6-12) | 4 | 2 | 1.8 | 22.3 | 57% |
| 第3週(1/13-19) | 5 | 1 | 1.1 | 14.2 | 83% |
| 第4週(1/20-26) | 5 | 1 | 0.9 | 12.8 | 83% |
| 第5週(1/27-31) | 3 | 1 | 1.3 | 16.1 | 75% |
| **月合計** | **20** | **7** | **1.3** | **22.3** | **74%** |`,
    },
  ],
};


// ============================================================
// パターン3: シミュレータ訓練実施報告書
// ============================================================

const pattern3: SamplePattern = {
  id: "simulator-training",
  label: "訓練実施報告",
  icon: "🎓",
  description: "ブリッジシミュレータを使った海技訓練の実施報告",
  reportTitle: "2026年1月度 ブリッジシミュレータ訓練実施報告書",
  additionalInstructions: "訓練効果の評価と次回改善点を具体的に記載してください。受講者の到達度に注目して所見をまとめること。",
  stockQuery: "ship bridge simulator navigation",
  generateImages: () => {
    // 受講者評価レーダーチャート風（簡易版）
    const { canvas: c1, ctx: ctx1 } = createCanvas(480, 340);
    drawBackground(ctx1, 480, 340, "#fefce8", "#fef08a");
    drawTitle(ctx1, "訓練コース別 受講者平均評価スコア", 100, 24, "#713f12");

    const courses = [
      { name: "BRM基礎", score: 4.2, max: 5, color: "#3b82f6" },
      { name: "DPオペ", score: 3.8, max: 5, color: "#8b5cf6" },
      { name: "狭水道", score: 3.5, max: 5, color: "#f59e0b" },
      { name: "荒天操船", score: 4.0, max: 5, color: "#22c55e" },
      { name: "離着桟", score: 3.9, max: 5, color: "#ec4899" },
      { name: "STS操船", score: 3.6, max: 5, color: "#06b6d4" },
    ];

    // 横棒グラフ
    const startY = 50;
    const barH = 36;
    courses.forEach((c, i) => {
      const y = startY + i * (barH + 8);
      ctx1.fillStyle = "#334155";
      ctx1.font = "11px sans-serif";
      ctx1.textAlign = "right";
      ctx1.fillText(c.name, 90, y + barH / 2 + 4);
      ctx1.textAlign = "left";

      // 背景バー
      const barMax = 340;
      ctx1.fillStyle = "#f1f5f9";
      ctx1.beginPath();
      ctx1.roundRect(100, y, barMax, barH, 4);
      ctx1.fill();

      // スコアバー
      const barW = (c.score / c.max) * barMax;
      ctx1.fillStyle = c.color;
      ctx1.beginPath();
      ctx1.roundRect(100, y, barW, barH, 4);
      ctx1.fill();

      // スコア表示
      ctx1.fillStyle = "#ffffff";
      ctx1.font = "bold 14px sans-serif";
      ctx1.fillText(`${c.score}`, barW + 90, y + barH / 2 + 5);

      // 目標ライン
      const targetX = 100 + (4.0 / c.max) * barMax;
      ctx1.strokeStyle = "#ef444480";
      ctx1.setLineDash([4, 3]);
      ctx1.beginPath();
      ctx1.moveTo(targetX, y);
      ctx1.lineTo(targetX, y + barH);
      ctx1.stroke();
      ctx1.setLineDash([]);
    });

    // 凡例
    ctx1.strokeStyle = "#ef4444";
    ctx1.setLineDash([4, 3]);
    ctx1.beginPath();
    ctx1.moveTo(140, 318);
    ctx1.lineTo(170, 318);
    ctx1.stroke();
    ctx1.setLineDash([]);
    ctx1.fillStyle = "#475569";
    ctx1.font = "10px sans-serif";
    ctx1.fillText("目標スコア 4.0", 174, 322);

    const img1 = c1.toDataURL("image/png");

    // 月別受講者数推移
    const { canvas: c2, ctx: ctx2 } = createCanvas(480, 280);
    drawBackground(ctx2, 480, 280, "#f8fafc", "#e2e8f0");
    drawTitle(ctx2, "月別 訓練受講者数・コース数 推移", 100, 22, "#1e293b");

    drawLineChart(ctx2, [
      { label: "受講者数", color: "#3b82f6", data: [32, 28, 45, 38, 42, 51] },
      { label: "コース数", color: "#f59e0b", data: [8, 7, 11, 9, 10, 13] },
    ], ["8月", "9月", "10月", "11月", "12月", "1月"], {
      x: 60, y: 40, w: 380, h: 190, maxValue: 60,
    });

    // 凡例
    ctx2.fillStyle = "#3b82f6";
    ctx2.fillRect(160, 258, 20, 4);
    ctx2.fillStyle = "#475569";
    ctx2.font = "10px sans-serif";
    ctx2.fillText("受講者数", 184, 262);
    ctx2.fillStyle = "#f59e0b";
    ctx2.fillRect(260, 258, 20, 4);
    ctx2.fillStyle = "#475569";
    ctx2.fillText("コース数", 284, 262);

    const img2 = c2.toDataURL("image/png");

    return [
      { fileName: "訓練コース別評価スコア.png", base64: img1, memo: "各コースの受講者平均評価" },
      { fileName: "月別受講者数推移.png", base64: img2, memo: "直近6ヶ月の受講者数とコース数" },
    ];
  },
  materials: [
    {
      fileName: "訓練実施記録.xlsx",
      fileType: "spreadsheet",
      memo: "1月の訓練コース実施記録",
      fileSize: 18700,
      textContent: `### シート: 1月訓練実績

| 日程 | コース名 | 受講者数 | 使用シミュレータ | 講師 | 平均スコア | 合格率 |
| --- | --- | --- | --- | --- | --- | --- |
| 1/7-8 | BRM基礎（2日間） | 6名 | フルミッションブリッジ | 佐々木 | 4.2/5.0 | 100% |
| 1/9-10 | DPオペレーター初級 | 4名 | DPシミュレータ | 高橋 | 3.8/5.0 | 75% |
| 1/14-15 | 狭水道航行訓練 | 5名 | フルミッションブリッジ | 佐々木 | 3.5/5.0 | 80% |
| 1/16 | 荒天操船（1日間） | 6名 | フルミッションブリッジ | 松本 | 4.0/5.0 | 100% |
| 1/20-21 | 離着桟操船訓練 | 4名 | フルミッションブリッジ | 佐々木 | 3.9/5.0 | 100% |
| 1/22-23 | STS操船訓練 | 5名 | フルミッションブリッジ | 松本 | 3.6/5.0 | 80% |
| 1/27 | ERM基礎（機関室） | 8名 | エンジンルームSIM | 伊藤 | 4.1/5.0 | 100% |
| 1/28-30 | BRM上級（3日間） | 5名 | フルミッションブリッジ | 佐々木・松本 | 4.3/5.0 | 100% |
| 1/31 | DP能力限界訓練 | 8名 | DPシミュレータ | 高橋 | 3.7/5.0 | 88% |`,
    },
    {
      fileName: "受講者アンケート集計.txt",
      fileType: "document",
      memo: "受講後アンケートの集計結果",
      fileSize: 1800,
      textContent: `2026年1月度 訓練受講者アンケート集計（回答者: 51名中48名、回答率94%）

■ 総合満足度: 4.3/5.0

■ 項目別評価
- 訓練内容の実務関連性: 4.5/5.0
- シミュレータの操作性: 4.2/5.0
- 講師の指導力: 4.6/5.0
- 訓練時間の適切さ: 3.8/5.0
- 施設・環境: 4.1/5.0

■ 自由記述（主な意見）
【良かった点】
- 「実際の航路データを使った訓練で非常にリアリティがあった」（狭水道コース・3等航海士）
- 「DPの限界特性を体感できたのは座学では得られない経験」（DPコース・1等航海士）
- 「BRM上級の意思決定訓練は、実際のブリッジチームで即活かせる」（BRM上級・船長）

【改善要望】
- 「2日間コースを3日間に延長してほしい。演習時間が足りない」（複数回答）
- 「夜間航行のシナリオをもっと増やしてほしい」
- 「VTS（船舶通航サービス）との通信訓練も組み込んでほしい」
- 「事前のeラーニング教材があると予習できて効率が良い」`,
    },
    {
      fileName: "主任講師コメント.webm",
      fileType: "audio",
      memo: "主任講師による月次総括",
      fileSize: 2200000,
      textContent: `主任講師の佐々木です。1月の訓練実施状況について報告します。
今月は合計9コース、延べ51名の受講者に訓練を実施しました。前年同月比で約20%の増加です。
特筆すべきは、BRM上級コースの受講者の質の高さです。全員が船長経験者で、非常にレベルの高い議論と演習ができました。
一方、DPオペレーター初級コースでは4名中1名が合格基準に達しませんでした。DP操作は経験が限定的な若手船員にとってハードルが高く、事前学習の強化が必要と考えます。
狭水道コースについても、来島海峡のシナリオで潮流対応に苦戦する受講者が多く見られました。来月以降、潮流影響の基礎講義を追加する予定です。
施設面では、360度フルミッションブリッジシミュレータの稼働率が95%を超えており、非常に高い稼働状況です。来年度の設備更新計画も視野に入れて検討を進めています。`,
    },
  ],
};


// ============================================================
// パターン4: 四半期事業実績レポート
// ============================================================

const pattern4: SamplePattern = {
  id: "quarterly-report",
  label: "四半期事業実績",
  icon: "📈",
  description: "3Q事業実績と主要KPIの報告",
  reportTitle: "2025年度 第3四半期 事業実績報告書",
  additionalInstructions: "前年同期比と計画比の両面から分析し、次四半期の見通しも記載してください。経営層向けの端的なサマリーを冒頭に入れること。",
  stockQuery: "business meeting corporate office",
  generateImages: () => {
    // 売上構成比 円グラフ
    const { canvas: c1, ctx: ctx1 } = createCanvas(480, 320);
    drawBackground(ctx1, 480, 320, "#f8fafc", "#e2e8f0");
    drawTitle(ctx1, "3Q 事業別売上構成比", 155, 22, "#1e293b");

    drawPieChart(ctx1, [
      { label: "海事コンサル", value: 35, color: "#3b82f6" },
      { label: "訓練事業", value: 28, color: "#22c55e" },
      { label: "洋上風力支援", value: 18, color: "#8b5cf6" },
      { label: "船舶管理", value: 12, color: "#f59e0b" },
      { label: "その他", value: 7, color: "#94a3b8" },
    ], 180, 180, 120);

    // 凡例
    const legends1 = [
      { label: "海事コンサル 35%", color: "#3b82f6" },
      { label: "訓練事業 28%", color: "#22c55e" },
      { label: "洋上風力支援 18%", color: "#8b5cf6" },
      { label: "船舶管理 12%", color: "#f59e0b" },
      { label: "その他 7%", color: "#94a3b8" },
    ];
    legends1.forEach((l, i) => {
      const x = 330;
      const y = 100 + i * 28;
      ctx1.fillStyle = l.color;
      ctx1.fillRect(x, y, 14, 14);
      ctx1.fillStyle = "#334155";
      ctx1.font = "12px sans-serif";
      ctx1.fillText(l.label, x + 20, y + 12);
    });

    const img1 = c1.toDataURL("image/png");

    // 四半期推移
    const { canvas: c2, ctx: ctx2 } = createCanvas(480, 300);
    drawBackground(ctx2, 480, 300, "#f8fafc", "#e2e8f0");
    drawTitle(ctx2, "四半期 売上・営業利益 推移（百万円）", 90, 22, "#1e293b");

    drawBarChart(ctx2, [
      { label: "1Q", value: 420, color: "#3b82f6" },
      { label: "2Q", value: 455, color: "#3b82f6" },
      { label: "3Q", value: 512, color: "#22c55e" },
      { label: "4Q予", value: 480, color: "#94a3b8" },
    ], { x: 60, y: 40, w: 200, h: 210, maxValue: 600 });

    // 営業利益（右側に配置）
    ctx2.fillStyle = "#1e293b";
    ctx2.font = "bold 12px sans-serif";
    ctx2.fillText("営業利益", 320, 50);

    const profitData = [
      { label: "1Q", value: 42, plan: 38 },
      { label: "2Q", value: 48, plan: 40 },
      { label: "3Q", value: 58, plan: 45 },
      { label: "4Q予", value: 50, plan: 42 },
    ];
    profitData.forEach((d, i) => {
      const y = 66 + i * 50;
      ctx2.fillStyle = "#334155";
      ctx2.font = "11px sans-serif";
      ctx2.fillText(d.label, 300, y + 12);
      // 実績バー
      const barW = (d.value / 70) * 140;
      ctx2.fillStyle = d.label === "4Q予" ? "#94a3b8" : "#22c55e";
      ctx2.beginPath();
      ctx2.roundRect(330, y, barW, 16, 3);
      ctx2.fill();
      ctx2.fillStyle = "#1e293b";
      ctx2.font = "bold 11px sans-serif";
      ctx2.fillText(`${d.value}`, 330 + barW + 6, y + 13);
      // 計画線
      const planX = 330 + (d.plan / 70) * 140;
      ctx2.strokeStyle = "#ef444480";
      ctx2.setLineDash([3, 3]);
      ctx2.beginPath();
      ctx2.moveTo(planX, y);
      ctx2.lineTo(planX, y + 16);
      ctx2.stroke();
      ctx2.setLineDash([]);
    });

    const img2 = c2.toDataURL("image/png");

    return [
      { fileName: "事業別売上構成比.png", base64: img1, memo: "3Q売上の事業セグメント別内訳" },
      { fileName: "四半期売上利益推移.png", base64: img2, memo: "四半期ごとの売上と営業利益の推移" },
    ];
  },
  materials: [
    {
      fileName: "3Q業績サマリー.xlsx",
      fileType: "spreadsheet",
      memo: "3Q決算実績値",
      fileSize: 28400,
      textContent: `### シート: 3Q業績

| 指標 | 3Q実績 | 3Q計画 | 計画比 | 前年同期 | 前年比 |
| --- | --- | --- | --- | --- | --- |
| 売上高（百万円） | 512 | 480 | 106.7% | 465 | 110.1% |
| 営業利益（百万円） | 58 | 45 | 128.9% | 41 | 141.5% |
| 営業利益率 | 11.3% | 9.4% | +1.9pt | 8.8% | +2.5pt |
| 受注残高（百万円） | 890 | 820 | 108.5% | 720 | 123.6% |
| 従業員数 | 186 | 180 | - | 172 | +14名 |

### シート: 事業別

| 事業セグメント | 売上（百万円） | 構成比 | 前年比 | 主な要因 |
| --- | --- | --- | --- | --- |
| 海事コンサルティング | 179 | 35% | +8% | 港湾リスク評価案件の増加 |
| 訓練事業 | 143 | 28% | +12% | DPコース需要増、海外顧客獲得 |
| 洋上風力支援 | 92 | 18% | +45% | 秋田沖PJ本格化 |
| 船舶管理 | 61 | 12% | +3% | 管理隻数横ばい |
| その他 | 37 | 7% | -5% | 一時案件の減少 |`,
    },
    {
      fileName: "事業ハイライト.txt",
      fileType: "document",
      memo: "3Qの主要トピックス",
      fileSize: 2400,
      textContent: `2025年度 3Q 事業ハイライト

■ 海事コンサルティング
- 大型案件: 東南アジア某港の航行安全評価を受注（契約額: 約4,500万円）
- シミュレーション技術を活用した新サービス「ポートリスクアセスメント」の提供開始
- ClassNK・DNV GLとの協業案件が3件成約

■ 訓練事業
- 受講者数: 3Q累計156名（前年同期比+22%）
- 新コース「自律運航対応 監視者訓練」を試験的に開始（受講者8名）
- 台湾の海運会社と年間契約を締結（年間30名規模）
- 360度ブリッジシミュレータの稼働率: 92%

■ 洋上風力支援
- 秋田沖プロジェクト: SEP船オペレーション支援が本格稼働
- CTV（乗員移送船）の安全運航コンサルを2件受注
- 洋上風力専門チームを4名→6名に増員

■ DX推進
- 社内業務効率化ツール「Foundry」を全部門展開開始
- Azure OpenAI活用の議事録自動生成ツールの運用開始
- ペーパーレス化推進により印刷コスト前年比▲35%

■ 人材
- 新卒2名、中途3名採用（うちDXエンジニア1名）
- 海技資格保有者の高齢化対策として、次世代育成プログラムを策定中`,
    },
    {
      fileName: "経営会議録音.webm",
      fileType: "audio",
      memo: "社長の3Q総括コメント",
      fileSize: 4200000,
      textContent: `社長の山本です。3Qの実績について総括します。
売上高512百万円、営業利益58百万円と、いずれも計画を上回る結果となりました。特に営業利益率11.3%は過去最高水準であり、利益体質の改善が着実に進んでいます。
牽引役は洋上風力支援事業です。前年比45%増と大幅に伸びており、秋田沖プロジェクトが本格化したことが大きく寄与しています。この分野は今後も拡大基調が続くと見ています。
訓練事業も好調です。海外顧客の獲得が進んでおり、台湾との年間契約は大きな一歩です。今後、東南アジアへの展開も加速させます。
課題としては、人材の確保です。特に洋上風力の専門人材は市場全体で不足しており、採用競争が激化しています。待遇改善と社内育成の両面で対応を進めます。
4Qも引き続き堅調な業績を見込んでおり、通期では過去最高業績の達成を目指します。`,
    },
    {
      fileName: "顧客満足度調査.csv",
      fileType: "spreadsheet",
      memo: "3Q顧客満足度サーベイ結果",
      fileSize: 520,
      textContent: `| カテゴリ | 3Q評価 | 2Q評価 | 前年3Q | 目標 |
| --- | --- | --- | --- | --- |
| 総合満足度 | 4.4/5.0 | 4.2/5.0 | 4.1/5.0 | 4.5 |
| サービス品質 | 4.5/5.0 | 4.3/5.0 | 4.2/5.0 | 4.5 |
| 対応スピード | 4.1/5.0 | 3.9/5.0 | 3.8/5.0 | 4.0 |
| 価格妥当性 | 3.8/5.0 | 3.7/5.0 | 3.6/5.0 | 4.0 |
| 再利用意向 | 92% | 89% | 85% | 90% |
| NPS | +38 | +32 | +28 | +40 |`,
    },
  ],
};


// ============================================================
// パターン5: 出張報告書（顧客訪問）
// ============================================================

const pattern5: SamplePattern = {
  id: "business-trip",
  label: "出張報告",
  icon: "✈️",
  description: "顧客訪問出張の報告と商談結果",
  reportTitle: "出張報告書: シンガポール顧客訪問（2026年1月20日〜24日）",
  additionalInstructions: "商談結果を明確にし、フォローアップのアクションアイテムを具体的に記載してください。次のステップと期限を明示すること。",
  stockQuery: "Singapore port harbor shipping",
  generateImages: () => {
    // 訪問スケジュール
    const { canvas: c1, ctx: ctx1 } = createCanvas(500, 320);
    drawBackground(ctx1, 500, 320, "#faf5ff", "#e9d5ff");
    drawTitle(ctx1, "訪問スケジュール（1/20-24）", 135, 22, "#581c87");

    const schedule = [
      { day: "1/20(月)", items: ["移動（羽田→チャンギ）", "ホテルチェックイン"], color: "#94a3b8" },
      { day: "1/21(火)", items: ["PIL社訪問・プレゼン", "DPコース提案商談"], color: "#3b82f6" },
      { day: "1/22(水)", items: ["PSA港湾局 表敬訪問", "Keppel Offshore視察"], color: "#22c55e" },
      { day: "1/23(木)", items: ["Eastern Pacific社 商談", "シンガポール海事局 挨拶"], color: "#8b5cf6" },
      { day: "1/24(金)", items: ["訪問先フォローアップ整理", "移動（チャンギ→羽田）"], color: "#94a3b8" },
    ];

    schedule.forEach((s, i) => {
      const y = 42 + i * 54;
      // 日付
      ctx1.fillStyle = s.color;
      ctx1.beginPath();
      ctx1.roundRect(14, y, 82, 44, 6);
      ctx1.fill();
      ctx1.fillStyle = "#fff";
      ctx1.font = "bold 12px sans-serif";
      ctx1.textAlign = "center";
      ctx1.fillText(s.day, 55, y + 27);
      ctx1.textAlign = "left";

      // アイテム
      s.items.forEach((item, j) => {
        ctx1.fillStyle = "#ffffff";
        ctx1.strokeStyle = s.color;
        ctx1.lineWidth = 1.5;
        ctx1.beginPath();
        ctx1.roundRect(110 + j * 190, y + 2, 180, 40, 6);
        ctx1.fill();
        ctx1.stroke();
        ctx1.lineWidth = 1;
        ctx1.fillStyle = "#334155";
        ctx1.font = "11px sans-serif";
        ctx1.fillText(item, 120 + j * 190, y + 26);
      });
    });

    const img1 = c1.toDataURL("image/png");

    // 商談パイプライン
    const { canvas: c2, ctx: ctx2 } = createCanvas(480, 280);
    drawBackground(ctx2, 480, 280, "#f0f9ff", "#bae6fd");
    drawTitle(ctx2, "商談パイプライン・ステータス", 130, 22, "#0c4a6e");

    const pipeline = [
      { company: "PIL社", deal: "DPコース年間契約", amount: "¥18M", status: "提案済", progress: 60, color: "#3b82f6" },
      { company: "Eastern Pacific", deal: "BRM訓練パッケージ", amount: "¥12M", status: "交渉中", progress: 40, color: "#f59e0b" },
      { company: "PSA港湾局", deal: "港湾安全コンサル", amount: "¥25M", status: "初期接触", progress: 20, color: "#8b5cf6" },
      { company: "Keppel Offshore", deal: "洋上風力O&M支援", amount: "¥35M", status: "情報収集", progress: 10, color: "#94a3b8" },
    ];

    pipeline.forEach((p, i) => {
      const y = 44 + i * 56;
      // 会社名
      ctx2.fillStyle = "#0f172a";
      ctx2.font = "bold 12px sans-serif";
      ctx2.fillText(p.company, 14, y + 14);
      ctx2.fillStyle = "#475569";
      ctx2.font = "10px sans-serif";
      ctx2.fillText(p.deal, 14, y + 30);

      // 金額
      ctx2.fillStyle = "#0f172a";
      ctx2.font = "bold 13px sans-serif";
      ctx2.textAlign = "right";
      ctx2.fillText(p.amount, 470, y + 14);
      ctx2.textAlign = "left";

      // プログレスバー
      ctx2.fillStyle = "#e2e8f0";
      ctx2.beginPath();
      ctx2.roundRect(200, y + 20, 200, 14, 7);
      ctx2.fill();
      ctx2.fillStyle = p.color;
      ctx2.beginPath();
      ctx2.roundRect(200, y + 20, p.progress * 2, 14, 7);
      ctx2.fill();

      // ステータス
      ctx2.fillStyle = p.color;
      ctx2.beginPath();
      ctx2.roundRect(410, y + 20, 56, 18, 9);
      ctx2.fill();
      ctx2.fillStyle = "#fff";
      ctx2.font = "bold 9px sans-serif";
      ctx2.textAlign = "center";
      ctx2.fillText(p.status, 438, y + 33);
      ctx2.textAlign = "left";
    });

    // 合計
    ctx2.fillStyle = "#0c4a6e";
    ctx2.font = "bold 13px sans-serif";
    ctx2.fillText("パイプライン合計: ¥90M（4案件）", 120, 268);

    const img2 = c2.toDataURL("image/png");

    return [
      { fileName: "訪問スケジュール.png", base64: img1, memo: "5日間の訪問スケジュール概要" },
      { fileName: "商談パイプライン.png", base64: img2, memo: "各商談の進捗とステータス" },
    ];
  },
  materials: [
    {
      fileName: "訪問先商談記録.xlsx",
      fileType: "spreadsheet",
      memo: "各訪問先での商談結果",
      fileSize: 15600,
      textContent: `### シート: 商談記録

| 訪問先 | 面談者 | 議題 | 先方の反応 | 次のアクション | 期限 |
| --- | --- | --- | --- | --- | --- |
| PIL社 | Mr. Tan(Fleet Director) | DPコース年間契約の提案 | 非常に前向き。見積り精査後に回答 | 詳細見積り送付 | 2/7 |
| PIL社 | Ms. Lim(Training Mgr) | BRM訓練カスタマイズ | シミュレータ見学を希望 | 東京招聘の日程調整 | 2/14 |
| PSA港湾局 | Mr. Chen(Safety Dept) | 港湾リスク評価の紹介 | ClassNK推薦もあり関心高い | 実績資料の送付 | 2/10 |
| Eastern Pacific | Capt. Wong | BRM＋ERM訓練パッケージ | 価格面で他社比較中 | 競合分析の上、価格再提案 | 2/21 |
| Keppel Offshore | Mr. Lee(Wind Div) | 洋上風力O&M支援の共同提案 | 長期的に協業可能性あり | MOU案の作成・送付 | 3/7 |`,
    },
    {
      fileName: "出張経費明細.csv",
      fileType: "spreadsheet",
      memo: "出張旅費精算",
      fileSize: 420,
      textContent: `| 項目 | 金額(円) | 備考 |
| --- | --- | --- |
| 航空券（羽田↔チャンギ） | 185,000 | JAL直行便エコノミー |
| ホテル（4泊） | 92,000 | Marina Bay Sands ※先方推薦 |
| 日当（5日分） | 25,000 | 社内規定に基づく |
| 現地交通費 | 12,500 | タクシー・Grab |
| 会食費（1/21 PIL社） | 38,000 | 4名分・会社経費 |
| 会食費（1/23 Eastern Pacific） | 32,000 | 3名分・会社経費 |
| 通信費 | 3,500 | 現地SIMカード |
| **合計** | **388,000** | |`,
    },
    {
      fileName: "出張振り返りメモ.txt",
      fileType: "document",
      memo: "出張後の振り返り・所感",
      fileSize: 1600,
      textContent: `シンガポール出張 振り返りメモ（2026/1/24 帰国後作成）

■ 全体所感
- シンガポール市場における当社の認知度は確実に向上している。ClassNK経由の紹介が大きい。
- 特にDP訓練需要は高い。東南アジアの洋上風力拡大に伴い、今後さらに増加見込み。
- 競合はKR（韓国船級）系の訓練機関と、現地の民間訓練会社。価格面では不利だが、品質・実績で差別化可能。

■ PIL社（最重要）
- Fleet Director のMr. Tanは意思決定者。DPコースへの関心が非常に高い。
- 年間20名規模の契約が見込める（約1,800万円）。
- ポイント: 来日してシミュレータを見学したいとの要望あり。2月中に招聘を実現したい。

■ Eastern Pacific
- BRM訓練に関心あるが、価格面で他社（香港の訓練機関）と比較中。
- 当社の360度シミュレータの優位性を訴求する必要あり。
- Capt. Wongは技術面では高く評価してくれている。価格交渉がカギ。

■ PSA・Keppel
- いずれも中長期的な関係構築フェーズ。
- PSAはClassNKの推薦があり、港湾安全コンサルの引き合いに発展する可能性。
- Keppelは洋上風力のO&M（運用保守）で将来的なパートナーになりうる。

■ 次回訪問
- 3月下旬にPIL社招聘後、4月に再訪予定。Eastern Pacificへの再提案も合わせて行う。`,
    },
    {
      fileName: "現地ヒアリング録音.webm",
      fileType: "audio",
      memo: "PIL社Mr.Tanとの面談要約",
      fileSize: 3100000,
      textContent: `PIL社のFleet DirectorであるMr. Tanとの面談の要約です。
まず冒頭でMr. Tanから、同社が保有する約80隻のフリートにおいて、DP対応船が今後3年間で15隻から25隻に増加する計画であるとの説明がありました。これに伴い、DP有資格者の育成が急務であるとのことです。
当社のDPシミュレータ訓練コースについて紹介したところ、特に360度の視界表現と、実際のDP制御盤を再現した操作環境に高い関心を示されました。
価格については、年間20名の受講で1名あたり90万円の見積りを提示しましたが、他社の相場（60-70万円程度）と比較してやや高いとのフィードバックがありました。ただし、品質面では当社が優位であると認識いただいており、最終的には品質重視で判断したいとのコメントをいただきました。
次のステップとして、2月中にPIL社のTraining Manager含め2-3名を東京に招聘し、実際のシミュレータを体験していただくことで合意しました。`,
    },
  ],
};

// ============================================================
// エクスポート
// ============================================================

export const SAMPLE_PATTERNS: SamplePattern[] = [
  pattern1,
  pattern2,
  pattern3,
  pattern4,
  pattern5,
];
