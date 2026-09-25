import type { LoginInput, RegisterInput, UserDto } from '@tesla-pool/shared';
import { apiFetch } from '@/lib/api-client';

export const authApi = {
  login: (input: LoginInput) =>
    apiFetch<{ user: UserDto }>('/auth/login', { method: 'POST', body: input }),
  register: (input: RegisterInput) =>
    apiFetch<{ user: UserDto }>('/auth/register', { method: 'POST', body: input }),
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
};
