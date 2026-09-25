import type { MigrationObject } from '@mikro-orm/core';
import { Migration20260925000001_initial_schema } from './Migration20260925000001_initial_schema';

// Ordered list of migrations, referenced explicitly so compiled JS needs no filesystem glob.
export const MIGRATIONS: MigrationObject[] = [
  { name: 'Migration20260925000001_initial_schema', class: Migration20260925000001_initial_schema },
];
