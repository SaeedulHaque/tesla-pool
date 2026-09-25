import pino, { type Logger } from 'pino';
import type { Env } from './config/env';

export function createLogger(env: Pick<Env, 'LOG_LEVEL'>): Logger {
  return pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
        'req.body.password',
        '*.password',
        '*.passwordHash',
      ],
      censor: '[redacted]',
    },
  });
}
