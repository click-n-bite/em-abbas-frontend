import { NextResponse } from 'next/server';
import { requireCaller, toErrorResponse } from '@/server/guard';
import { store, StoreError } from '@/server/store';
import type { Role } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ROLES: Role[] = ['superadmin', 'admin', 'agent'];

export async function GET(request: Request) {
  try {
    requireCaller(request, ['superadmin', 'admin', 'agent']);
    return NextResponse.json(await store.listUsers());
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const caller = requireCaller(request, ['superadmin', 'admin']);
    const body = (await request.json()) as Record<string, unknown>;

    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim();
    const role = String(body.role ?? 'agent') as Role;

    if (!name || !email) throw new StoreError(400, 'VALIDATION', 'Name and e-mail are required');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new StoreError(400, 'VALIDATION', 'Invalid e-mail');
    }
    if (!ROLES.includes(role)) throw new StoreError(400, 'VALIDATION', 'Invalid role');
    if (role === 'superadmin' && caller.role !== 'superadmin') {
      throw new StoreError(403, 'FORBIDDEN', 'users.onlySuperadminRole');
    }

    const user = await store.createUser({
      name,
      email,
      role,
      phone: body.phone === null ? null : String(body.phone ?? '') || null,
      phoneCountry: body.phoneCountry === null ? null : String(body.phoneCountry ?? '') || null,
      active: body.active === undefined ? true : Boolean(body.active),
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
