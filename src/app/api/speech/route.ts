import { NextRequest, NextResponse } from "next/server";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";

export async function POST(request: NextRequest) {
  try {
    const { text, rate } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "テキストが必要です" }, { status: 400 });
    }

    const speechKey = process.env.AZURE_SPEECH_KEY;
    const speechRegion = process.env.AZURE_SPEECH_REGION;

    if (!speechKey || !speechRegion) {
      return NextResponse.json(
        { error: "Azure Speech設定がありません" },
        { status: 500 }
      );
    }

    // 速度設定（50%-200% → -50% to +100%）
    const speedRate = rate ? `${(rate - 100)}%` : "0%";

    // SSMLを構築
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ja-JP">
        <voice name="ja-JP-NanamiNeural">
          <prosody rate="${speedRate}">
            ${escapeXml(text)}
          </prosody>
        </voice>
      </speak>
    `;

    const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

    // メモリに音声を出力
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, undefined);

    return new Promise<NextResponse>((resolve) => {
      synthesizer.speakSsmlAsync(
        ssml,
        (result) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            const audioData = result.audioData;
            synthesizer.close();
            resolve(
              new NextResponse(audioData, {
                headers: {
                  "Content-Type": "audio/mpeg",
                  "Content-Length": audioData.byteLength.toString(),
                },
              })
            );
          } else {
            synthesizer.close();
            console.error("Speech synthesis failed:", result.errorDetails);
            resolve(
              NextResponse.json(
                { error: "音声合成に失敗しました" },
                { status: 500 }
              )
            );
          }
        },
        (error) => {
          synthesizer.close();
          console.error("Speech synthesis error:", error);
          resolve(
            NextResponse.json(
              { error: "音声合成エラー" },
              { status: 500 }
            )
          );
        }
      );
    });
  } catch (error) {
    console.error("Speech API error:", error);
    return NextResponse.json(
      { error: "音声APIエラー" },
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
