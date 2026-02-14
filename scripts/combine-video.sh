#!/bin/bash

# 動画出力ディレクトリ
VIDEO_DIR="demo-video"
AUDIO_DIR="demo-video/audio"
OUTPUT_FILE="demo-video/foundry_demo.mp4"

# 録画された動画ファイルを見つける
VIDEO_FILE=$(ls -t $VIDEO_DIR/*.webm 2>/dev/null | head -1)

if [ -z "$VIDEO_FILE" ]; then
  echo "Error: No video file found in $VIDEO_DIR"
  exit 1
fi

echo "Video file: $VIDEO_FILE"

# 音声ファイルを連結
echo "Concatenating audio files..."
AUDIO_FILES=""
for f in $AUDIO_DIR/*.mp3; do
  AUDIO_FILES="$AUDIO_FILES|$f"
done
AUDIO_FILES="${AUDIO_FILES:1}"  # 先頭の | を削除

# 音声を連結して一つのファイルに
ffmpeg -y -i "concat:$AUDIO_FILES" -acodec libmp3lame -q:a 2 "$VIDEO_DIR/narration_combined.mp3" 2>/dev/null

# または、ffmpegのconcat demuxerを使用
echo "file '01_intro.mp3'" > "$AUDIO_DIR/audio_list.txt"
echo "file '02_company.mp3'" >> "$AUDIO_DIR/audio_list.txt"
echo "file '03_rag.mp3'" >> "$AUDIO_DIR/audio_list.txt"
echo "file '04_swot.mp3'" >> "$AUDIO_DIR/audio_list.txt"
echo "file '05_explore.mp3'" >> "$AUDIO_DIR/audio_list.txt"
echo "file '06_ranking.mp3'" >> "$AUDIO_DIR/audio_list.txt"
echo "file '07_strategies.mp3'" >> "$AUDIO_DIR/audio_list.txt"
echo "file '08_insights.mp3'" >> "$AUDIO_DIR/audio_list.txt"
echo "file '09_closing.mp3'" >> "$AUDIO_DIR/audio_list.txt"

cd "$AUDIO_DIR"
ffmpeg -y -f concat -safe 0 -i audio_list.txt -c copy "../narration_combined.mp3"
cd - > /dev/null

echo "Combined audio: $VIDEO_DIR/narration_combined.mp3"

# 動画と音声を結合
echo "Combining video and audio..."
ffmpeg -y \
  -i "$VIDEO_FILE" \
  -i "$VIDEO_DIR/narration_combined.mp3" \
  -c:v libx264 \
  -preset fast \
  -crf 23 \
  -c:a aac \
  -b:a 128k \
  -shortest \
  "$OUTPUT_FILE"

echo ""
echo "✅ Demo video created: $OUTPUT_FILE"
echo ""
# ファイルサイズと長さを表示
ls -lh "$OUTPUT_FILE"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUTPUT_FILE" 2>/dev/null | xargs -I {} echo "Duration: {} seconds"
