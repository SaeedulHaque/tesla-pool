import type { ApiErrorBody } from '@tesla-pool/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT';
  body?: unknown;
  signal?: AbortSignal;
}

/** Every call goes to same-origin /api/*, which the Next.js proxy forwards to the API. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK', 'Could not reach the server.');
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const failure = (json as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      failure?.code ?? 'UNKNOWN',
      failure?.message ?? 'Unexpected response from the server.',
      failure?.requestId,
    );
  }
  return json as T;
}
