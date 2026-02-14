# 勝ち筋ファインダー - Claude Code ルール

## 開発サーバー
- **ポート3006固定** - 使用中なら解放してから起動
- 起動: `npm run dev:safe`
- サーバー起動は `run_in_background` 使用禁止（Exit code 137の原因）

## テスト
- APIテスト: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3006/`
- Playwright: `npx playwright test`
- **UI変更時は必ずブラウザで実操作を確認**（APIが200返すだけでは不十分）

## デプロイ（Azure）
- RAGシードファイル: `prisma/seed-data/rag-documents.json`
- 起動時にRAG 0件なら自動シード
- 手動シード: `POST /api/seed`
