import type { NextConfig } from 'next';
import { execSync } from 'child_process';

let buildVersion = 'dev';
try {
  buildVersion = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch {
  /* not a git repo or git unavailable — keep "dev" */
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@openthrone/shared', '@openthrone/game-logic'],
  env: {
    NEXT_PUBLIC_BUILD_VERSION: buildVersion,
  },
};

export default nextConfig;
