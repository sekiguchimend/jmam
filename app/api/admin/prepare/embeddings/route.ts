export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { processEmbeddingQueueBatch } from '@/actions/prepare';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    const limit = typeof body.limit === 'number' ? body.limit : 50;
    const result = await processEmbeddingQueueBatch(limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : '準備処理に失敗しました' },
      { status: 500 }
    );
  }
}


