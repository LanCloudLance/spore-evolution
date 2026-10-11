import type { AnchorHTMLAttributes } from 'react';

export default function Link({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...props}
      href={href === '/ocean' ? '#ocean' : href === '/' ? '#main' : href}
    >
      {children}
    </a>
  );
}
