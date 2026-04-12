import { createHash, randomBytes } from 'node:crypto';

export const AUTH_COOKIE_NAME = 'fortune_ai_session';
export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const createSessionToken = (): string => randomBytes(32).toString('hex');

export const hashSessionToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const buildSessionExpiry = (): string =>
  new Date(Date.now() + AUTH_SESSION_MAX_AGE_SECONDS * 1000).toISOString();
