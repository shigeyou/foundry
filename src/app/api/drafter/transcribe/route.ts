import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Whisper API用のOpenAIクライアント
// Azure OpenAI Whisperデプロイメントがあればそれを使用、なければOpenAI直接
function getWhisperClient(): OpenAI {
  if (process.env.AZURE_WHISPER_DEPLOYMENT) {
    return new OpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_WHISPER_DEPLOYMENT}`,
      defaultQuery: { "api-version": "2024-06-01" },
      defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY },
    });
  }

  // OpenAI直接（OPENAI_API_KEYが必要）
  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // Azure Speech-to-Text へフォールバック
  throw new Error("WHISPER_NOT_CONFIGURED");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "音声ファイルが必要です" }, { status: 400 });
    }

    const fileName = file.name;
    const ext = fileName.split(".").pop()?.toLowerCase();
    const supportedFormats = ["mp3", "wav", "m4a", "webm", "ogg", "flac", "mp4", "mpeg", "mpga"];

    if (!ext || !supportedFormats.includes(ext)) {
      return NextResponse.json(
        { error: `未対応の音声形式です: .${ext}。対応形式: ${supportedFormats.join(", ")}` },
        { status: 400 }
      );
    }

    try {
      const client = getWhisperClient();

      const transcription = await client.audio.transcriptions.create({
        file: file,
        model: process.env.AZURE_WHISPER_DEPLOYMENT || "whisper-1",
        language: "ja",
        response_format: "text",
      });

      return NextResponse.json({
        success: true,
        fileName,
        text: typeof transcription === "string" ? transcription : (transcription as { text: string }).text,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "WHISPER_NOT_CONFIGURED") {
        // Azure Speech-to-Text でフォールバック
        return await transcribeWithAzureSpeech(file, fileName);
      }
      throw err;
    }
  } catch (error) {
    console.error("Transcription error:", error);
    const message = error instanceof Error ? error.message : "文字起こし中にエラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function transcribeWithAzureSpeech(file: File, fileName: string): Promise<NextResponse> {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION || "japaneast";

  if (!speechKey) {
    return NextResponse.json(
      { error: "音声文字起こしの設定がありません。OPENAI_API_KEY、AZURE_WHISPER_DEPLOYMENT、またはAZURE_SPEECH_KEYのいずれかを設定してください。" },
      { status: 500 }
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Azure Speech-to-Text REST API
    const url = `https://${speechRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ja-JP`;

    const contentType = file.type || "audio/wav";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": speechKey,
        "Content-Type": contentType,
        "Accept": "application/json",
      },
      body: buffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Azure Speech error:", errorText);
      return NextResponse.json(
        { error: `Azure Speech APIエラー: ${response.status}` },
        { status: 500 }
      );
    }

    const result = await response.json();
    const text = result.DisplayText || result.RecognitionStatus || "";

    return NextResponse.json({
      success: true,
      fileName,
      text,
    });
  } catch (error) {
    console.error("Azure Speech transcription error:", error);
    return NextResponse.json(
      { error: "Azure Speech文字起こし中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
