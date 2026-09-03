import { NextResponse } from 'next/server';
import type { Role } from '@/lib/types';
import { resolveRole } from '@/lib/config';
import { StoreError } from './store';

interface Caller {
  email: string;
  role: Role;
}

function decode(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Authorize a request to the portal-managed endpoints.
 *
 * The bearer token is the access token issued by the EMA API. Its signature is
 * NOT verified here because the portal does not hold the backend's signing key:
 * the check covers presence, expiry and the resolved role only. Move these
 * endpoints into the EMA API (or add the shared secret) before treating this as
 * a security boundary — see README “Portal-managed data”.
 */
export function requireCaller(request: Request, allowed: Role[]): Caller {
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new StoreError(401, 'UNAUTHORIZED', 'Missing bearer token');

  const claims = decode(token);
  if (!claims) throw new StoreError(401, 'UNAUTHORIZED', 'Malformed token');

  const exp = typeof claims.exp === 'number' ? claims.exp : null;
  if (exp !== null && exp * 1000 < Date.now()) {
    throw new StoreError(401, 'TOKEN_EXPIRED', 'Token expired');
  }

  const email = String(claims.email ?? claims.sub ?? '');
  const role = resolveRole(email, claims.role);
  if (!allowed.includes(role)) {
    throw new StoreError(403, 'FORBIDDEN', 'users.forbidden');
  }
  return { email, role };
}

/** Convert a thrown StoreError (or anything else) into a JSON response. */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof StoreError) {
    return NextResponse.json(
      { code: error.code, message: error.message },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { code: 'INTERNAL_ERROR', message: 'Unexpected server error' },
    { status: 500 },
  );
}
