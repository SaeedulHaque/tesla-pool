import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link href="/" className="mt-4 inline-block text-sm font-medium text-brand-700 underline">
        Back to start
      </Link>
    </main>
  );
}
