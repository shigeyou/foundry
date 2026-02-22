import { NextRequest, NextResponse } from "next/server";

// テキストを文単位でチャンク分割（最大800文字程度）
function splitTextIntoChunks(text: string, maxChunkSize = 800): string[] {
  const chunks: string[] = [];

  // 文末で分割（。！？\n）
  const sentences = text.split(/(?<=[。！？\n])/);
  let currentChunk = "";

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// 単一チャンクの音声を生成
async function synthesizeChunk(
  text: string,
  speechKey: string,
  speechRegion: string,
  speedRate: string
): Promise<ArrayBuffer> {
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ja-JP">
  <voice name="ja-JP-NanamiNeural">
    <prosody rate="${speedRate}" pitch="-5%">
      ${escapeXml(text)}
    </prosody>
  </voice>
</speak>`;

  const endpoint = `https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": speechKey,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-16khz-32kbitrate-mono-mp3",
    },
    body: ssml,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure Speech error: ${response.status} ${errorText}`);
  }

  return response.arrayBuffer();
}

export async function POST(request: NextRequest) {
  try {
    const { text, rate } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "テキストが必要です" }, { status: 400 });
    }

    const speechKey = process.env.AZURE_SPEECH_KEY;
    const speechRegion = process.env.AZURE_SPEECH_REGION || "japaneast";

    if (!speechKey) {
      console.error("AZURE_SPEECH_KEY is not set");
      return NextResponse.json(
        { error: "Azure Speech設定がありません" },
        { status: 500 }
      );
    }

    // 速度設定（50-200% → -50% to +100%）
    const numericRate = rate ? rate - 100 : 0;
    const speedRate = `${numericRate >= 0 ? '+' : ''}${numericRate}%`;

    // テキストをチャンクに分割
    const chunks = splitTextIntoChunks(text);
    console.log(`[Speech API] Generating speech: ${text.length} chars, ${chunks.length} chunks, rate: ${speedRate}`);

    // 各チャンクの音声を生成
    const audioBuffers: ArrayBuffer[] = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[Speech API] Processing chunk ${i + 1}/${chunks.length}: ${chunks[i].length} chars`);
      const buffer = await synthesizeChunk(chunks[i], speechKey, speechRegion, speedRate);
      audioBuffers.push(buffer);
    }

    // バッファを結合
    const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const combinedBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const buffer of audioBuffers) {
      combinedBuffer.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }

    console.log(`[Speech API] Success: ${combinedBuffer.byteLength} bytes (${chunks.length} chunks combined)`);

    return new NextResponse(combinedBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": combinedBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("[Speech API] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Azure認証エラーの場合は明確なメッセージを返す
    if (errorMessage.includes("401")) {
      return NextResponse.json(
        { error: "Azure Speech APIキーが無効です。キーを更新してください。" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: `音声APIエラー: ${errorMessage}` },
      { status: 500 }
    );
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
