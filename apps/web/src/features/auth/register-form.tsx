'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RegisterBodySchema } from '@tesla-pool/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorText } from '@/components/ui/error-state';
import { TextField } from '@/components/ui/field';
import { authApi } from './api';
import { useAuthForm } from './use-auth-form';

export function RegisterForm() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const { fieldErrors, formError, pending, onSubmit } = useAuthForm(
    RegisterBodySchema,
    authApi.register,
  );

  return (
    <Card>
      <h1 className="text-xl font-semibold">Create your account</h1>
      <form
        className="mt-4 space-y-4"
        noValidate
        onSubmit={(event) => onSubmit(event, { fullName, phone, password })}
      >
        <TextField
          id="fullName"
          label="Your name"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={fieldErrors.fullName}
        />
        <TextField
          id="phone"
          label="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="01700000000"
          hint="You'll sign in with this number."
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={fieldErrors.phone}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />
        {formError && <ErrorText message={formError} />}
        <Button type="submit" className="w-full" busy={pending}>
          Create account
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already registered?{' '}
        <Link href="/login" className="font-medium text-brand-700 underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
