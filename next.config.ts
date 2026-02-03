import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // バンドルサイズ最適化
  experimental: {
    // 未使用のエクスポートを自動削除（tree-shaking強化）
    optimizePackageImports: ["lucide-react"],
    // Server Actions のボディサイズ制限（デフォルト1MB→100MB）
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  // 画像最適化
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // 本番ビルド時のソースマップを無効化（バンドルサイズ削減）
  productionBrowserSourceMaps: false,
};

export default nextConfig;
