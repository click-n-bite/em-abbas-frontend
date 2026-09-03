import { NextResponse } from 'next/server';
import { requireCaller, toErrorResponse } from '@/server/guard';
import { store } from '@/server/store';

export const dynamic = 'force-dynamic';

/** Remove a notification number. */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    requireCaller(request, ['superadmin', 'admin']);
    await store.deleteNotifyPhone(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
