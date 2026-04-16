/** @type {import('next').NextConfig} */
const nextConfig = {
  // 生产打包为最小体积的独立服务（含 node_modules 裁剪）
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
