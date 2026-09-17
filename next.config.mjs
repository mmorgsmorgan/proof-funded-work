/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config, { isServer }) {
    if (isServer) config.externals.push('node:sqlite');
    return config;
  },
};
export default nextConfig;
