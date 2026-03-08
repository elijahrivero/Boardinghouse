/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'localhost',
      },
    ],
  },
  turbopack: {
    // Empty turbopack config to silence the warning
  },
};

module.exports = nextConfig;
