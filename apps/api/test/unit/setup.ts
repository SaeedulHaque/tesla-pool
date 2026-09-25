import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import { beforeAll } from 'vitest';
import { buildOrmOptions } from '../../src/database/mikro-orm.config';

// Entities carry ORM mapping, and collections need discovered metadata to work. Discovery does
// not need a database, so unit tests stay fast and pure.
beforeAll(async () => {
  await MikroORM.init({
    ...buildOrmOptions({
      DATABASE_URL: 'postgresql://unit:unit@localhost:1/unit',
      DATABASE_SSL: false,
      LOG_LEVEL: 'silent',
    }),
    connect: false,
  });
});
