import { InvalidTransitionError } from './domain-error';

/** Table-driven state machine: one readable transition table per lifecycle. */
export class StateMachine<S extends string> {
  constructor(
    private readonly name: string,
    private readonly transitions: Readonly<Record<S, readonly S[]>>,
  ) {}

  can(from: S, to: S): boolean {
    return this.transitions[from].includes(to);
  }

  assert(from: S, to: S): void {
    if (!this.can(from, to)) throw new InvalidTransitionError(this.name, from, to);
  }

  states(): S[] {
    return Object.keys(this.transitions) as S[];
  }
}
