import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    loader: 'custom',
    loaderFile: './src/lib/storage/image-loader.ts',
  },
  serverExternalPackages: ['@electric-sql/pglite'],
  // The cloud name is not secret; the image loader needs it in the browser.
  env: { NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? '' },
};

export default nextConfig;
