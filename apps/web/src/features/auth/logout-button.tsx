'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { authApi } from './api';

export function LogoutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    setBusy(true);
    try {
      await authApi.logout();
    } catch {
      // Even if the call fails the cookie is httpOnly and expires on its own; go to sign-in regardless.
    }
    queryClient.clear();
    router.replace('/login');
    router.refresh();
  };

  return (
    <Button variant="ghost" busy={busy} onClick={logout}>
      Sign out
    </Button>
  );
}
