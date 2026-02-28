import { PrismaClient } from "../src/generated/prisma/index.js";
const prisma = new PrismaClient();

function sanitize(code) {
  if (!code) return code;
  return code.split("\n").map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith("style ") || trimmed.startsWith("%%")) return line;

    if (/^\s*subgraph\s+/.test(line)) {
      return line.replace(/[（(][^）)]*[）)]/g, "").replace(/\s+$/, "");
    }

    let result = line;
    // Node labels: convert () to fullwidth inside []
    result = result.replace(/\[([^\]]*)\]/g, (match, content) => {
      return "[" + content.replace(/\(/g, "（").replace(/\)/g, "）") + "]";
    });

    // Edge labels: remove parens inside ||
    result = result.replace(/\|([^|]*)\|/g, (match, label) => {
      return "|" + label.replace(/[（()）]/g, "").replace(/\s+/g, " ").trim() + "|";
    });

    return result;
  }).join("\n");
}

const flows = await prisma.bottleneckFlow.findMany();
let fixed = 0;
for (const flow of flows) {
  const updates = {};
  const m1 = sanitize(flow.mermaidCode);
  const m2 = sanitize(flow.afterMermaidCode);
  if (m1 !== flow.mermaidCode) updates.mermaidCode = m1;
  if (m2 !== flow.afterMermaidCode) updates.afterMermaidCode = m2;
  if (Object.keys(updates).length > 0) {
    await prisma.bottleneckFlow.update({ where: { id: flow.id }, data: updates });
    fixed++;
  }
}
console.log(`Fixed ${fixed} / ${flows.length} flows`);
await prisma.$disconnect();
