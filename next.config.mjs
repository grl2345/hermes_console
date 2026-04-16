/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 使用 webpack 构建（Turbopack 对中文路径有 bug）
  buildActivity: false,
}

export default nextConfig
