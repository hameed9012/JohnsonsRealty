// next/image loader. Storage IDs are Cloudinary public IDs ("jr/listings/abc123"); absolute URLs
// and local paths (dev/test "local" storage driver, static assets) pass through.
const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (src.startsWith('/') || src.startsWith('http') || src.startsWith('data:') || !cloud) {
    const sep = src.includes('?') ? '&' : '?';
    return src.startsWith('data:') ? src : `${src}${sep}w=${width}`;
  }
  const q = quality ? `q_${quality}` : 'q_auto';
  return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,${q},c_limit,w_${width}/${src}`;
}
