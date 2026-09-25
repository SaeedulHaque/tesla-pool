'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { ZodType, ZodTypeDef } from 'zod';
import { messageForError } from '@/lib/error-messages';

type FieldErrors = Record<string, string>;

/**
 * Shared behaviour of the login and register forms: validate with the same Zod schema the API
 * uses, submit, then land on the home route (which redirects by role).
 */
export function useAuthForm<Input extends Record<string, string>>(
  schema: ZodType<unknown, ZodTypeDef, unknown>,
  submit: (values: Input) => Promise<unknown>,
) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>, values: Input) => {
    event.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    setPending(true);
    try {
      await submit(values);
      router.replace('/');
      router.refresh();
    } catch (error) {
      setFormError(messageForError(error));
      setPending(false);
    }
  };

  return { fieldErrors, formError, pending, onSubmit };
}
