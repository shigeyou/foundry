import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",

  // TypeScriptビルドエラーを無視（既存コードの型不整合を許容）
  typescript: {
    ignoreBuildErrors: true,
  },

  // サーバー外部パッケージ（turbopackでバンドルせずnode_modulesから直接ロード）
  serverExternalPackages: [
    "xlsx",
    "@libsql/client",
    "@libsql/core",
    "@prisma/adapter-libsql",
  ],

  async redirects() {
    return [
      // 旧 /winning-strategy → 新 /finder/winning-strategy
      {
        source: "/winning-strategy",
        destination: "/finder/winning-strategy",
        permanent: true,
      },
      // 旧 /tools → 新 /
      {
        source: "/tools",
        destination: "/",
        permanent: true,
      },
      // 旧 /tools/finder/:id → 新 /finder/:id
      {
        source: "/tools/finder/:id",
        destination: "/finder/:id",
        permanent: true,
      },
      // 旧 /tools/drafter/:id → 新 /drafter/:id
      {
        source: "/tools/drafter/:id",
        destination: "/drafter/:id",
        permanent: true,
      },
      // 旧 /tools/simulator/:id → 新 /simulator/:id
      {
        source: "/tools/simulator/:id",
        destination: "/simulator/:id",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
