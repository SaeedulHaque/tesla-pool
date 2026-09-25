import type { MigrationObject } from '@mikro-orm/core';

// Ordered list of migrations, referenced explicitly so compiled JS needs no filesystem glob.
export const MIGRATIONS: MigrationObject[] = [];
