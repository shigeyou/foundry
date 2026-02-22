import fs from "fs";
import path from "path";
import crypto from "crypto";
import pdfParse from "pdf-parse";
import JSZip from "jszip";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const dbPath = path.resolve(__dirname, "..", "prisma", "dev.db");
const adapter = new PrismaLibSQL({
  url: `file:${dbPath}`,
});

const prisma = new PrismaClient({ adapter });

// PPTXからテキストを抽出
async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const texts: string[] = [];

  const slideFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml")
  );

  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
    const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
    return numA - numB;
  });

  for (const slidePath of slideFiles) {
    const content = await zip.files[slidePath].async("string");
    const textMatches = content.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
    if (textMatches) {
      const slideTexts = textMatches
        .map((match) => match.replace(/<[^>]+>/g, ""))
        .filter((text) => text.trim());
      if (slideTexts.length > 0) {
        const slideNum = slidePath.match(/slide(\d+)/)?.[1];
        texts.push(`[スライド${slideNum}]\n${slideTexts.join("\n")}`);
      }
    }
  }

  return texts.join("\n\n");
}

async function importDocument(filePath: string) {
  const filename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase().slice(1);
  const buffer = fs.readFileSync(filePath);
  let content = "";
  const metadata: Record<string, unknown> = {};

  console.log(`Importing: ${filename}`);

  if (ext === "pdf") {
    const pdfData = await pdfParse(buffer);
    content = pdfData.text;
    metadata.pages = pdfData.numpages;
    metadata.info = pdfData.info;
  } else if (ext === "pptx") {
    content = await extractTextFromPptx(buffer);
    const slideCount = (content.match(/\[スライド\d+\]/g) || []).length;
    metadata.slides = slideCount;
  }

  const doc = await prisma.rAGDocument.create({
    data: {
      id: crypto.randomUUID(),
      filename,
      fileType: ext,
      content,
      metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
    },
  });

  console.log(`  Created: ${doc.id} (${content.length.toLocaleString()} characters)`);
  return doc;
}

async function main() {
  const docsDir = path.join(__dirname, "..", "docs");
  const files = fs.readdirSync(docsDir);

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if ([".pdf", ".pptx"].includes(ext)) {
      const filePath = path.join(docsDir, file);
      await importDocument(filePath);
    }
  }

  console.log("Done!");
  await prisma.$disconnect();
}

main().catch(console.error);
