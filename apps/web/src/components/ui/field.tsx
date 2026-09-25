import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const CONTROL =
  'block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 disabled:opacity-60';

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

function FieldShell({ id, label, error, hint, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  id,
  label,
  error,
  hint,
  ...rest
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={CONTROL}
      />
    </FieldShell>
  );
}

export function SelectField({
  id,
  label,
  error,
  children,
  ...rest
}: { id: string; label: string; error?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell id={id} label={label} error={error}>
      <select
        id={id}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={CONTROL}
      >
        {children}
      </select>
    </FieldShell>
  );
}
