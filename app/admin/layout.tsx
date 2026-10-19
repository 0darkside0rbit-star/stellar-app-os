import type { ReactNode } from 'react';
import Link from 'next/link';
import { requireAdminAccess } from '@/lib/auth/admin';

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  await requireAdminAccess();

  return (
    <>
      <nav aria-label="Admin navigation">
        <ul>
          <li>
            <Link href="/admin">Dashboard</Link>
          </li>
          <li>
            <Link href="/admin/newsletter">Newsletter</Link>
          </li>
        </ul>
      </nav>
      {children}
    </>
  );
}