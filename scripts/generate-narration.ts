import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import * as fs from 'fs';
import * as path from 'path';

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY!;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'japaneast';

// ナレーションセクション（6分版・詳細化）
const narrations = [
  {
    id: '01_intro',
    text: `勝ち筋ファインダーへようこそ。
このアプリは、AIの力を借りて、企業の「勝ち筋」を探索するツールです。
RAG、つまり外部データを検索・参照する仕組みと、大規模言語モデルが持つ広範な知識を組み合わせることで、
多角的な戦略オプションを提案します。
まずは、アプリの概要と基本的な使い方をご紹介します。`,
  },
  {
    id: '02_overview',
    text: `画面上部にあるタブが、このアプリの全体構成です。
左から順に見ていきましょう。
「対象企業」で探索対象の企業情報を設定し、
「RAG情報」で会社資料を登録します。
「SWOT」ではAIがSWOT分析を行い、
「スコア設定」で評価基準を調整できます。
「勝ち筋探索」がメインの機能で、AIに問いを投げかけて勝ち筋を発見します。
「ランキング」では発見した勝ち筋をスコア順に確認し、採否を判断します。
「シン・勝ち筋の探求」では、採用した勝ち筋をさらに進化させます。
そして「インサイト」で、全体の傾向を分析します。`,
  },
  {
    id: '03_company',
    text: `まず、「対象企業」タブから設定を始めましょう。
ここでは、勝ち筋を探したい企業の基本情報を入力します。
企業名、事業内容、強み、課題などを記載してください。
便利な機能として、「Webサイトから読み込む」があります。
企業のホームページURLを入力するだけで、AIが自動的に情報を取得し、
フォームに反映してくれます。
親会社がある場合は、その関係性も設定でき、グループ全体での勝ち筋探索が可能になります。`,
  },
  {
    id: '04_rag',
    text: `次に、「RAG情報」タブです。
ここでは、会社案内、事業計画、決算資料など、参考となる文書を登録できます。
PDFやテキストファイルをアップロードすると、AIがその内容を理解し、
勝ち筋を探索する際の知識ベースとして活用します。
登録する資料が具体的で充実しているほど、AIの提案精度が向上します。`,
  },
  {
    id: '04b_score',
    text: `続いて「スコア設定」タブです。
ここでは、勝ち筋を評価する6つの軸の重み付けを調整できます。
収益ポテンシャル、収益化までの距離、競合優位性、実行可能性、本社貢献、合併シナジーの6軸があります。
デフォルト設定のまま進めて問題ありませんが、
自社の評価基準に合わせたい場合はスライダーで調整してください。
例えば、短期での収益化を重視する場合は「収益化までの距離」の重みを上げます。`,
  },
  {
    id: '05_swot',
    text: `「SWOT」タブでは、登録した情報をもとに、AIがSWOT分析を自動実行します。
強み、弱み、機会、脅威の4つの観点から、企業の現状を整理します。
「再分析」ボタンをクリックすると、最新の登録情報で分析が更新されます。
結果に違和感がある場合は、補足情報を追加して再度分析することも可能です。
この分析結果は、後続の勝ち筋探索でAIが参照する重要な情報になります。`,
  },
  {
    id: '06_explore',
    text: `いよいよ本題の「勝ち筋探索」です。
ここでは、AIに「問い」を投げかけることで、勝ち筋のアイデアを引き出します。
例えば、「既存の強みを活かした新規事業は？」「競合との差別化ポイントは？」といった問いを入力します。
初めての方には、「プリセット質問」をおすすめします。
よく使われる問いがバッジとして表示されており、クリックするだけで質問が設定されます。`,
  },
  {
    id: '07_preset',
    text: `では、実際にプリセット質問を使って探索してみましょう。
バッジをクリックすると、問いが入力欄に設定されます。
そのまま「探索する」ボタンを押すと、AIが勝ち筋の探索を開始します。
プログレスバーで進行状況を確認できます。
探索が完了すると、複数の勝ち筋が提案されます。
各勝ち筋には、収益ポテンシャル、収益化までの距離、競合優位性など、
6つの軸でスコアが付けられ、総合評価が表示されます。
気になる勝ち筋があれば、詳細を展開して内容を確認できます。`,
  },
  {
    id: '08_ranking',
    text: `「ランキング」タブには、これまでの探索で見つかった勝ち筋が、スコア順に一覧表示されます。
行をクリックすると、詳細情報が展開され、なぜ勝てるのか、どう実現するのかが確認できます。
ここで重要なのが「採用」「却下」の判断です。
あなたが「これは良い」と思った勝ち筋を採用ボタンで選択すると、
AIがその傾向を学習し、次回以降の提案に反映されます。
この繰り返しによって、AIはあなた好みの勝ち筋を提案できるようになります。`,
  },
  {
    id: '09_strategies',
    text: `「シン・勝ち筋の探求」では、より高度な2つの機能を提供しています。
まず「進化生成」は、あなたが採用した勝ち筋をベースに、
遺伝的アルゴリズムの考え方を応用して、さらに良い勝ち筋を生み出します。
一部を変える「突然変異」、複数を組み合わせる「交叉」、
逆の視点から検証する「反証」という3つのアプローチで進化させます。
次に「AI自動探索」は、AIが自ら問いを立て、探索し、高スコアの勝ち筋を自動で発見する機能です。
人間が思いつかない切り口から、新しい可能性を見つけてくれることがあります。`,
  },
  {
    id: '10_insights',
    text: `「インサイト」タブでは、探索結果を俯瞰的に分析します。
「学習パターン」は、あなたの採用・却下の履歴からAIが好みのパターンを抽出します。
どんな特徴の勝ち筋が採用されやすいのか、傾向が見えてきます。
「メタ分析」は、全ての探索結果を横断的に分析し、
繰り返し現れるテーマや、本質的な勝ちパターンを発見します。
個々の勝ち筋だけでなく、全体像を把握することで、より深い洞察が得られます。`,
  },
  {
    id: '11_closing',
    text: `以上が、勝ち筋ファインダーの基本的な使い方です。
このアプリは、AIを「答えを出してくれる存在」ではなく、
「思考を広げる触媒」として活用することを目指しています。
前提となる情報が正確であれば、AIは強力な壁打ち相手になります。
ただし、最終的な判断は必ず人間が行ってください。
ぜひ、このツールを活用して、あなたの企業の勝ち筋を見つけてください。
ご視聴ありがとうございました。`,
  },
];

async function generateNarration(
  text: string,
  outputFile: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      AZURE_SPEECH_KEY,
      AZURE_SPEECH_REGION
    );

    // Nanami（日本語女性）ボイスを使用
    speechConfig.speechSynthesisVoiceName = 'ja-JP-NanamiNeural';
    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outputFile);
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    // SSMLでスピードと抑揚を調整（少しゆっくりめ）
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ja-JP">
        <voice name="ja-JP-NanamiNeural">
          <prosody rate="0.92" pitch="+0%">
            ${text}
          </prosody>
        </voice>
      </speak>
    `;

    synthesizer.speakSsmlAsync(
      ssml,
      (result) => {
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          console.log(`Generated: ${outputFile}`);
          resolve();
        } else {
          console.error(`Error: ${result.errorDetails}`);
          reject(new Error(result.errorDetails));
        }
        synthesizer.close();
      },
      (error) => {
        console.error(`Error: ${error}`);
        synthesizer.close();
        reject(error);
      }
    );
  });
}

async function main() {
  const outputDir = path.join(process.cwd(), 'demo-video', 'audio');

  // 出力ディレクトリを作成
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Generating narration audio files (6-minute version)...');
  console.log(`Using voice: ja-JP-NanamiNeural`);

  for (const narration of narrations) {
    const outputFile = path.join(outputDir, `${narration.id}.mp3`);
    console.log(`\nProcessing: ${narration.id}`);
    await generateNarration(narration.text, outputFile);
  }

  console.log('\n✅ All narration audio files generated!');
  console.log(`Output directory: ${outputDir}`);
}

main().catch(console.error);
