/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // output: 'export',
  distDir: 'dist',
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL || 'https://xo-project.onrender.com'
  }
};

module.exports = nextConfig;
