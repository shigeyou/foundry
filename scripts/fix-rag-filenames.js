// RAGドキュメントの文字化けファイル名を修正するスクリプト
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const fixes = [
  {
    id: "cmkqepqgv000cftbwde9zp8ab",
    filename: "操船シュミレータパンフレット.pdf",
  },
  {
    id: "cmkqem356000bftbwfngk4ld7",
    filename: "商船三井マリテックス株式会社 会社概要 (2025年6月).pdf",
  },
  {
    id: "cmkqekx1l000aftbwqjpek4be",
    filename: "【日本語版】事業案内：商船三井マリテックス(2025年10月).pptx",
  },
  {
    id: "cmkqejlb50009ftbw28zyjgkq",
    filename: "【確定】商船三井マリテックス 船主様向けサービスのご紹介20251210.pptx",
  },
  {
    id: "cmkqei9sk0008ftbwq1ggjpyr",
    filename: "【2025年】風力事業パンフレット.pdf",
  },
  {
    id: "cmkqeh3260007ftbwajhtjoim",
    filename: "（日本語版）商船三井マリテックス会社案内パンフレット_202504011.pdf",
  },
];

async function main() {
  console.log("RAGドキュメントのファイル名を修正中...\n");

  for (const fix of fixes) {
    try {
      const result = await prisma.ragDocument.update({
        where: { id: fix.id },
        data: { filename: fix.filename },
      });
      console.log(`✓ 修正完了: ${fix.filename}`);
    } catch (error) {
      console.error(`✗ エラー (${fix.id}): ${error.message}`);
    }
  }

  console.log("\n修正完了！");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
