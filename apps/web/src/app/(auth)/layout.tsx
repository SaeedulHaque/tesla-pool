import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSessionUser } from '@/lib/server-session';

export const dynamic = 'force-dynamic';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (user) redirect(user.role === 'DRIVER' ? '/driver' : '/ride');
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <p className="mb-6 text-center text-2xl font-bold text-brand-700">Dhaka Tesla Pool</p>
      {children}
    </main>
  );
}
