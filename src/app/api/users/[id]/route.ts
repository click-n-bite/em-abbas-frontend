import { NextResponse } from 'next/server';
import { requireCaller, toErrorResponse } from '@/server/guard';
import { store, StoreError } from '@/server/store';
import type { Role } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ROLES: Role[] = ['superadmin', 'admin', 'agent'];

type Params = { params: { id: string } };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const caller = requireCaller(request, ['superadmin', 'admin']);
    const body = (await request.json()) as Record<string, unknown>;

    if (body.role !== undefined) {
      const role = String(body.role) as Role;
      if (!ROLES.includes(role)) throw new StoreError(400, 'VALIDATION', 'Invalid role');
      if (role === 'superadmin' && caller.role !== 'superadmin') {
        throw new StoreError(403, 'FORBIDDEN', 'users.onlySuperadminRole');
      }
    }
    if (body.email !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(body.email))) {
      throw new StoreError(400, 'VALIDATION', 'Invalid e-mail');
    }

    const user = await store.updateUser(params.id, {
      name: body.name === undefined ? undefined : String(body.name),
      email: body.email === undefined ? undefined : String(body.email),
      role: body.role === undefined ? undefined : (String(body.role) as Role),
      phone: body.phone === undefined ? undefined : body.phone === null ? null : String(body.phone),
      phoneCountry:
        body.phoneCountry === undefined
          ? undefined
          : body.phoneCountry === null
            ? null
            : String(body.phoneCountry),
      active: body.active === undefined ? undefined : Boolean(body.active),
    });

    return NextResponse.json(user);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    requireCaller(request, ['superadmin', 'admin']);
    await store.deleteUser(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
