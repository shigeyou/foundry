const drafterId = process.argv[2] || "minutes";
console.log("Seeding templates for:", drafterId);

const templates = [
  {
    name: "サンプル議事録テンプレート_001.md",
    content: `# 議事録

## 会議情報
- **日時**: YYYY年MM月DD日（曜日） HH:MM〜HH:MM
- **場所**:
- **出席者**:

## 議題
1.
2.
3.

## 議事内容

### 1. 議題1
- 説明:
- 議論:
- 決定事項:

### 2. 議題2
- 説明:
- 議論:
- 決定事項:

## 決定事項まとめ
| No | 決定事項 | 担当者 | 期限 |
|----|----------|--------|------|
| 1 | | | |
| 2 | | | |

## 今後のアクション
| No | アクション | 担当者 | 期限 | 状況 |
|----|------------|--------|------|------|
| 1 | | | | 未着手 |
| 2 | | | | 未着手 |
| 3 | | | | 未着手 |

## 次回予定
- 日時:
- 議題:

## 参考資料
-

## 備考

`,
    isDefault: true,
  },
];

async function createTemplates() {
  for (const t of templates) {
    try {
      const res = await fetch("http://localhost:3006/api/drafter/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drafterId: drafterId,
          name: t.name,
          content: t.content,
          isDefault: t.isDefault,
        }),
      });
      const data = await res.json();
      console.log("Created:", t.name, res.ok ? "OK" : "FAILED");
    } catch (err) {
      console.error("Error creating", t.name, err.message);
    }
  }
}

createTemplates();
