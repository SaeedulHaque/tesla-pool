export type ActorKind = 'USER' | 'SYSTEM';

/** Who caused a change. `SYSTEM` is recorded as a NULL actor in `ride_events`. */
export class Actor {
  private constructor(
    readonly kind: ActorKind,
    readonly userId: string | null,
  ) {}

  static user(userId: string): Actor {
    return new Actor('USER', userId);
  }

  static system(): Actor {
    return new Actor('SYSTEM', null);
  }
}
