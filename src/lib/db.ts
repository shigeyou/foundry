import { PrismaClient } from "@/generated/prisma";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import path from "path";

// DATABASE_URLを解決 - 相対パス file:./prisma/dev.db を絶対パスに変換
const dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";
let resolvedUrl = dbUrl;

if (dbUrl.startsWith("file:./")) {
  const relativePath = dbUrl.replace("file:./", "");
  const absolutePath = path.resolve(process.cwd(), relativePath);
  resolvedUrl = `file:${absolutePath}`;
}

const adapter = new PrismaLibSQL({
  url: resolvedUrl,
});

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
