import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@openthrone/shared', '@openthrone/game-logic'],
};

export default nextConfig;
