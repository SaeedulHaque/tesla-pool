import type { EntityManager } from '@mikro-orm/postgresql';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../src/modules/auth/auth.service';
import type { PasswordHasher } from '../../src/modules/auth/password-hasher';
import type { User } from '../../src/modules/auth/user.entity';
import type { UserRepository } from '../../src/modules/auth/user.repository';
import {
  InvalidCredentialsError,
  PhoneAlreadyRegisteredError,
  UnauthenticatedError,
} from '../../src/shared/domain/domain-error';
import type { Transactor } from '../../src/shared/transactor';

class InMemoryUsers implements UserRepository {
  readonly rows: User[] = [];
  async findById(_em: EntityManager, id: string) {
    return this.rows.find((user) => user.id === id) ?? null;
  }
  async findByPhone(_em: EntityManager, phone: string) {
    return this.rows.find((user) => user.phone === phone) ?? null;
  }
  add(_em: EntityManager, user: User): void {
    this.rows.push(user);
  }
}

const fakeEm = { flush: async () => undefined } as unknown as EntityManager;
const transactor: Transactor = { run: (work) => work(fakeEm) };

const hasher: PasswordHasher = {
  hash: vi.fn(async (plain: string) => `hashed:${plain}`),
  verify: vi.fn(async (hash: string, plain: string) => hash === `hashed:${plain}`),
};

function build() {
  const users = new InMemoryUsers();
  const issue = vi.fn(
    async ({ userId, role }: { userId: string; role: string }) => `token:${userId}:${role}`,
  );
  const service = new AuthService(transactor, users, hasher, { issue });
  return { service, users, issue };
}

describe('AuthService', () => {
  it('registers a passenger with a hashed password and issues a session', async () => {
    const { service, users, issue } = build();
    const result = await service.register({
      fullName: 'Nusrat',
      phone: '+8801800000003',
      password: 'secret-pass-1',
    });

    expect(result.user).toMatchObject({ fullName: 'Nusrat', role: 'PASSENGER' });
    expect(users.rows).toHaveLength(1);
    expect(users.rows[0].passwordHash).toBe('hashed:secret-pass-1');
    expect(issue).toHaveBeenCalledWith({ userId: users.rows[0].id, role: 'PASSENGER' });
    expect(result.token).toBe(`token:${users.rows[0].id}:PASSENGER`);
  });

  it('refuses to register a phone twice', async () => {
    const { service } = build();
    const input = { fullName: 'Rafiq', phone: '+8801800000004', password: 'secret-pass-1' };
    await service.register(input);
    await expect(service.register(input)).rejects.toBeInstanceOf(PhoneAlreadyRegisteredError);
  });

  it('logs in with the right password', async () => {
    const { service } = build();
    await service.register({
      fullName: 'Shirin',
      phone: '+8801800000005',
      password: 'secret-pass-1',
    });
    const result = await service.login({ phone: '+8801800000005', password: 'secret-pass-1' });
    expect(result.user.fullName).toBe('Shirin');
  });

  it('rejects a wrong password with InvalidCredentialsError', async () => {
    const { service } = build();
    await service.register({
      fullName: 'Shirin',
      phone: '+8801800000005',
      password: 'secret-pass-1',
    });
    await expect(
      service.login({ phone: '+8801800000005', password: 'nope-nope-1' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('rejects an unknown phone the same way, still spending one hash verification', async () => {
    const { service } = build();
    vi.mocked(hasher.verify).mockClear();
    await expect(
      service.login({ phone: '+8801999999999', password: 'whatever-1' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(hasher.verify).toHaveBeenCalledTimes(1);
  });

  it('me() returns the user, or UnauthenticatedError when the account is gone', async () => {
    const { service } = build();
    const { user } = await service.register({
      fullName: 'Nusrat',
      phone: '+8801800000003',
      password: 'secret-pass-1',
    });
    expect(await service.me(user.id)).toEqual(user);
    await expect(service.me('missing')).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
