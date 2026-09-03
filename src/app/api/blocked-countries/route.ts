import { NextResponse } from 'next/server';
import { requireCaller, toErrorResponse } from '@/server/guard';
import { store } from '@/server/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    requireCaller(request, ['superadmin', 'admin', 'agent']);
    return NextResponse.json(await store.listBlockedCountries());
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const caller = requireCaller(request, ['superadmin', 'admin']);
    const body = (await request.json()) as Record<string, unknown>;
    const entry = await store.blockCountry({
      code: String(body.code ?? ''),
      callingCode: String(body.callingCode ?? ''),
      reason: body.reason === null ? null : String(body.reason ?? '') || null,
      createdBy: String(body.createdBy ?? caller.email) || null,
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
