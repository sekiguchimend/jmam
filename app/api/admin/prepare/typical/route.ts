export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { rebuildTypicalExamplesForBucket } from '@/actions/prepare';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      caseId?: string;
      question?: 'problem' | 'solution';
      scoreBucket?: number;
      maxClusters?: number;
    };

    if (!body.caseId || !body.question || typeof body.scoreBucket !== 'number') {
      return NextResponse.json(
        { ok: false, error: 'caseId, question, scoreBucket は必須です' },
        { status: 400 }
      );
    }

    const result = await rebuildTypicalExamplesForBucket({
      caseId: body.caseId,
      question: body.question,
      scoreBucket: body.scoreBucket,
      maxClusters: body.maxClusters,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : '準備処理に失敗しました' },
      { status: 500 }
    );
  }
}


