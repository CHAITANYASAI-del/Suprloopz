'use client';
// Portal is determined by the URL path prefix (single Vercel deployment).
import { usePathname } from 'next/navigation';
import { ADMIN_PREFIX } from './routes';

export function isAdminPath(pathname) {
  return (pathname || '').startsWith(ADMIN_PREFIX);
}

/** Hook: 'admin' when under /admin, otherwise 'vendor'. */
export function usePortal() {
  return isAdminPath(usePathname()) ? 'admin' : 'vendor';
}
