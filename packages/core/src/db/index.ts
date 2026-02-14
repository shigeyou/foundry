import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

// グローバル変数でシングルトンを管理
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  dbInitialized: boolean;
};

let prismaInstance: PrismaClient | null = null;

/**
 * Prismaクライアントを初期化（libSQL adapter使用）
 */
export function initializeDB(databaseUrl?: string): PrismaClient {
  if (prismaInstance) {
    return prismaInstance;
  }

  const adapter = new PrismaLibSQL({
    url: databaseUrl || process.env.DATABASE_URL || 'file:./dev.db',
  });

  prismaInstance = new PrismaClient({
    adapter,
  });

  // 開発環境ではホットリロード対策
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaInstance;
  }

  globalForPrisma.dbInitialized = true;

  return prismaInstance;
}

/**
 * Prismaクライアントを取得（未初期化の場合は自動初期化）
 */
export function getDB(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  if (!prismaInstance) {
    return initializeDB();
  }

  return prismaInstance;
}

/**
 * DBが初期化済みかどうかをチェック
 */
export function isDBInitialized(): boolean {
  return globalForPrisma.dbInitialized || false;
}

/**
 * DB接続をクローズ
 */
export async function closeDB(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
    globalForPrisma.prisma = undefined;
    globalForPrisma.dbInitialized = false;
  }
}

// 便利なエクスポート
export { PrismaClient };
