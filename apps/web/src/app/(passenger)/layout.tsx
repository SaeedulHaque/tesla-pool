import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppHeader } from '@/components/app-header';
import { getSessionUser } from '@/lib/server-session';

export const dynamic = 'force-dynamic';

/** Defense in depth: the API enforces every rule, this just keeps people out of the wrong screens. */
export default async function PassengerLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'PASSENGER') redirect('/driver');
  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </>
  );
}
