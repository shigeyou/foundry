# 勝ち筋ファインダー - Claude Code プロジェクトルール

## 基本ルール

### 変更後は必ずURLを提示
- アプリに変更を加えた後は、**必ず該当ページのURLを提示**する
- ローカル、Azure、本番環境いずれの場合も同様
- ユーザーが`Ctrl+クリック`でページを開けるようにする
- 例: `http://localhost:3000/explore`

## 開発サーバー

### ポート番号は固定（3000）
- 開発サーバーは **常にポート3000** で起動する
- ポート3000が使用中の場合は、**別のポートに変更せず**、以下の手順で対応：
  1. `netstat -ano | grep ":3000"` でプロセスIDを確認
  2. `powershell -Command "Stop-Process -Id <PID> -Force"` でプロセスを終了
  3. ポートが解放されたことを確認してから `npm run dev` を実行

### サーバー起動手順
```bash
# 1. ポート確認
netstat -ano | grep ":3000"

# 2. 使用中なら解放
powershell -Command "Stop-Process -Id <PID> -Force"

# 3. ロックファイル削除（必要に応じて）
rm -rf .next/dev/lock

# 4. サーバー起動
npm run dev
```

## テスト

### 変更後は必ずテストを実行
アプリに変更を加えた後は、以下のテストを実施すること：

1. **APIテスト**（curl）
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/core/services
   ```

2. **Playwrightテスト**（ブラウザ操作テスト）
   ```bash
   npx playwright test
   ```

3. **統合テスト**
   ```bash
   npx playwright test tests/integration.spec.ts
   ```

### テスト対象ページ
- `/` - ホーム
- `/swot` - SWOT分析
- `/explore` - 勝ち筋探索
- `/core` - コア情報管理
- `/history` - 探索履歴

## デプロイ（Azure）

### デプロイ後の必須作業：RAGドキュメント同期

**重要**: Azure版はSQLiteデータベースが永続化されないため、デプロイ後はRAGドキュメントが0件になる。
デプロイ後は必ずローカルのRAGドキュメントをAzure版に同期すること。

```bash
# 1. ローカルからRAGドキュメントをエクスポート（コンテンツ含む）
node -e "
const ids = [/* ローカルのドキュメントIDリスト */];
async function main() {
  const docs = [];
  for (const id of ids) {
    const res = await fetch('http://localhost:3000/api/rag?id=' + id);
    const data = await res.json();
    if (data.document) {
      docs.push({
        filename: data.document.filename,
        fileType: data.document.fileType,
        content: data.document.content,
        metadata: data.document.metadata
      });
    }
  }
  console.log(JSON.stringify({ documents: docs }));
}
main();
" 2>/dev/null > /tmp/rag-export.json

# 2. Azure版にインポート（文字化け対策: charset=utf-8を明示）
curl -X POST "https://kachisuji-finder.azurewebsites.net/api/rag" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @/tmp/rag-export.json
```

### 文字化け対策
- インポート時は必ず `charset=utf-8` を指定する
- `--data-binary` を使用してバイナリデータとして送信する
- ファイル名に日本語が含まれる場合は特に注意

### デプロイ手順チェックリスト
1. [ ] `git push origin master` でコードをプッシュ
2. [ ] GitHub Actionsのデプロイ完了を確認
3. [ ] **RAGドキュメントをAzure版に同期**（上記手順）
4. [ ] Azure版でRAGドキュメント件数を確認
5. [ ] 動作確認（SWOT、勝ち筋探索など）

## 技術スタック
- Next.js 16 (Turbopack)
- TypeScript
- Tailwind CSS v4
- Prisma (SQLite)
- Azure OpenAI
- Tavily API (Web検索)

## 環境変数
必要な環境変数は `.env` に記述：
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION`
- `TAVILY_API_KEY`
