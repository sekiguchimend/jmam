// 事前準備（Embedding作成 / 典型例生成）
// - アップロード時: embedding_queue に投入
// - このアクションで: embedding_queue を処理して response_embeddings を作成し、k-meansで典型例を作る

'use server';

import { isAdmin, getAccessToken } from '@/lib/supabase/server';
import {
  processEmbeddingQueueBatchWithToken,
  rebuildTypicalExamplesForBucketWithToken,
} from '@/lib/prepare/worker';

export async function processEmbeddingQueueBatch(limit: number = 50): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  if (!(await isAdmin())) {
    throw new Error('管理者権限がありません');
  }
  const token = await getAccessToken();
  if (!token) throw new Error('管理者トークンが見つかりません（再ログインしてください）');
  return await processEmbeddingQueueBatchWithToken(token, limit);
}

export async function rebuildTypicalExamplesForBucket(params: {
  caseId: string;
  question: 'problem' | 'solution';
  scoreBucket: number;
  maxClusters?: number;
}): Promise<{ clusters: number; points: number }> {
  if (!(await isAdmin())) {
    throw new Error('管理者権限がありません');
  }
  const token = await getAccessToken();
  if (!token) throw new Error('管理者トークンが見つかりません（再ログインしてください）');
  return await rebuildTypicalExamplesForBucketWithToken({
    adminToken: token,
    caseId: params.caseId,
    question: params.question,
    scoreBucket: params.scoreBucket,
    maxClusters: params.maxClusters,
  });
}


