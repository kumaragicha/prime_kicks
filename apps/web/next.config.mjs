/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@prime-kicks/ui',
    '@prime-kicks/utils',
    '@prime-kicks/types',
    '@prime-kicks/validation',
  ],
};

export default nextConfig;
