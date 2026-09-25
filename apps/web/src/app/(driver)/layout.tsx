import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppHeader } from '@/components/app-header';
import { getSessionUser } from '@/lib/server-session';

export const dynamic = 'force-dynamic';

export default async function DriverLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'DRIVER') redirect('/ride');
  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </>
  );
}
