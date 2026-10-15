import { NextResponse } from 'next/server';
import { syncAll } from '@/lib/sync';
import { errorResponse, requireUser } from '@/lib/sync/route-helpers';

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireUser();
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  try {
    return NextResponse.json(await syncAll(auth.db, body.tz));
  } catch (err) {
    return errorResponse(err);
  }
}
