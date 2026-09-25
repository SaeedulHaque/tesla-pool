import type { RequestHandler, Response } from 'express';
import type { ZodType, ZodTypeDef } from 'zod';
import { ValidationFailedError } from '../shared/domain/domain-error';

type Schema<T> = ZodType<T, ZodTypeDef, unknown>;

function describe(issues: { path: (string | number)[]; message: string }[]): string {
  return issues.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`).join('; ');
}

function parse<T>(schema: Schema<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationFailedError(describe(result.error.issues));
  return result.data; // unknown keys are stripped by z.object()
}

/** Replaces `req.body` with the parsed value. */
export function validateBody<T>(schema: Schema<T>): RequestHandler {
  return (req, _res, next) => {
    req.body = parse(schema, req.body ?? {});
    next();
  };
}

/** Express 5 makes `req.query` read-only, so parsed values live on `res.locals`. */
export function validateQuery<T>(schema: Schema<T>): RequestHandler {
  return (req, res, next) => {
    res.locals.query = parse(schema, req.query);
    next();
  };
}

export function validateParams<T>(schema: Schema<T>): RequestHandler {
  return (req, res, next) => {
    res.locals.params = parse(schema, req.params);
    next();
  };
}

export const parsedQuery = <T>(res: Response): T => res.locals.query as T;
export const parsedParams = <T>(res: Response): T => res.locals.params as T;
