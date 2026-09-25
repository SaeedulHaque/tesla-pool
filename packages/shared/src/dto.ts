import type { UserRole } from './statuses';

export interface UserDto {
  id: string;
  fullName: string;
  phone: string;
  role: UserRole;
}

export interface ApiErrorBody {
  error: { code: string; message: string; requestId: string };
}
