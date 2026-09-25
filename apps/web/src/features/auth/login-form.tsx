'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LoginBodySchema } from '@tesla-pool/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorText } from '@/components/ui/error-state';
import { TextField } from '@/components/ui/field';
import { authApi } from './api';
import { useAuthForm } from './use-auth-form';

export function LoginForm() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const { fieldErrors, formError, pending, onSubmit } = useAuthForm(LoginBodySchema, authApi.login);

  return (
    <Card>
      <h1 className="text-xl font-semibold">Sign in</h1>
      <form
        className="mt-4 space-y-4"
        noValidate
        onSubmit={(event) => onSubmit(event, { phone, password })}
      >
        <TextField
          id="phone"
          label="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="01800000003"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={fieldErrors.phone}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />
        {formError && <ErrorText message={formError} />}
        <Button type="submit" className="w-full" busy={pending}>
          Sign in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        New here?{' '}
        <Link href="/register" className="font-medium text-brand-700 underline">
          Create a passenger account
        </Link>
      </p>
    </Card>
  );
}
