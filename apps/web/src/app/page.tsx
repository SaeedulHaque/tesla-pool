import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server-session';

export const dynamic = 'force-dynamic';

/** Signed-in people go to their side of the app; everyone else signs in. */
export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  redirect(user.role === 'DRIVER' ? '/driver' : '/ride');
}
