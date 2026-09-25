import type { LoginBody, RegisterBody, UserDto } from '@tesla-pool/shared';
import {
  InvalidCredentialsError,
  PhoneAlreadyRegisteredError,
  UnauthenticatedError,
} from '../../shared/domain/domain-error';
import type { Transactor } from '../../shared/transactor';
import type { PasswordHasher } from './password-hasher';
import type { SessionClaims } from './token-service';
import { User } from './user.entity';
import type { UserRepository } from './user.repository';

export interface AuthResult {
  user: UserDto;
  token: string;
}

export interface SessionIssuer {
  issue(claims: SessionClaims): Promise<string>;
}

export function toUserDto(user: User): UserDto {
  return { id: user.id, fullName: user.fullName, phone: user.phone, role: user.role };
}

export class AuthService {
  /** Hash of a throwaway password: unknown phones still cost one verify (no timing oracle). */
  private decoyHash: Promise<string> | null = null;

  constructor(
    private readonly transactor: Transactor,
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionIssuer,
  ) {}

  /** Passenger sign-up. Drivers are seeded, never self-registered. */
  async register(input: RegisterBody): Promise<AuthResult> {
    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.transactor.run(async (em) => {
      if (await this.users.findByPhone(em, input.phone)) throw new PhoneAlreadyRegisteredError();
      const created = new User(input.fullName, input.phone, passwordHash, 'PASSENGER');
      this.users.add(em, created);
      await em.flush();
      return created;
    });
    return {
      user: toUserDto(user),
      token: await this.sessions.issue({ userId: user.id, role: user.role }),
    };
  }

  async login(input: LoginBody): Promise<AuthResult> {
    const user = await this.transactor.run((em) => this.users.findByPhone(em, input.phone));
    const hash = user ? user.passwordHash : await this.getDecoyHash();
    const matches = await this.hasher.verify(hash, input.password);
    if (!user || !matches) throw new InvalidCredentialsError();
    return {
      user: toUserDto(user),
      token: await this.sessions.issue({ userId: user.id, role: user.role }),
    };
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.transactor.run((em) => this.users.findById(em, userId));
    if (!user) throw new UnauthenticatedError('Your account no longer exists. Sign in again.');
    return toUserDto(user);
  }

  private getDecoyHash(): Promise<string> {
    this.decoyHash ??= this.hasher.hash('decoy-password-for-timing');
    return this.decoyHash;
  }
}
