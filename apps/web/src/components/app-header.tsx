'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserDto } from '@tesla-pool/shared';
import { LogoutButton } from '@/features/auth/logout-button';

const NAV = {
  PASSENGER: [
    { href: '/ride', label: 'Ride' },
    { href: '/rides', label: 'History' },
  ],
  DRIVER: [
    { href: '/driver', label: 'Dashboard' },
    { href: '/driver/trips', label: 'Trips' },
  ],
} as const;

export function AppHeader({ user }: { user: UserDto }) {
  const pathname = usePathname();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-base font-bold text-brand-700">
            Tesla Pool
          </Link>
          <nav aria-label="Main" className="flex gap-1">
            {NAV[user.role].map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/driver' && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-600 sm:inline">{user.fullName}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
