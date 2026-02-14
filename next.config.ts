import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // xlsxパッケージをサーバー外部パッケージとして指定
  serverExternalPackages: ["xlsx"],

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

export default nextConfig;
