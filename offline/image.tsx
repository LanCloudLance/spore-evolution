import type { ImgHTMLAttributes } from 'react';

export default function Image({
  unoptimized: _unoptimized,
  alt,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) {
  // oxlint-disable-next-line next/no-img-element -- This standalone build embeds the original image and has no image server.
  return <img {...props} alt={alt ?? ''} />;
}
