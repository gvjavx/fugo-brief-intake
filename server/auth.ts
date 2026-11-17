import { createHash, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export const SESSION_COOKIE = 'fugo_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// Hash first so timingSafeEqual gets equal-length buffers and the length of the secret does not leak.
function safeEqual(a: string, b: string): boolean {
  const hash = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(hash(a), hash(b));
}

export function checkAdminCredentials(email: string, password: string): boolean {
  const emailOk = safeEqual(email.trim().toLowerCase(), requireEnv('ADMIN_EMAIL').toLowerCase());
  const passwordOk = safeEqual(password, requireEnv('ADMIN_PASSWORD'));
  return emailOk && passwordOk;
}

export function createSessionToken(email: string): string {
  return jwt.sign({ sub: email }, requireEnv('SESSION_SECRET'), { expiresIn: SESSION_TTL_SECONDS });
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: '/',
  };
}

export function readSession(req: Request): string | null {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string') return null;
  try {
    const payload = jwt.verify(token, requireEnv('SESSION_SECRET'));
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!readSession(req)) {
    res.status(401).json({ error: 'Silakan login terlebih dahulu' });
    return;
  }
  next();
}
