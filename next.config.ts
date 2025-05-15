import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export',
  // 画像最適化機能を無効化（静的エクスポートでは必要）
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
