import { NextResponse } from 'next/server';
import { requireCaller, toErrorResponse } from '@/server/guard';
import { store } from '@/server/store';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: { code: string } }) {
  try {
    requireCaller(request, ['superadmin', 'admin']);
    await store.unblockCountry(params.code);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
