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
  question: 'q1' | 'q2';
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

// スコア分布を計算・更新する（特定ケース・質問）
export async function updateScoreDistribution(params: {
  caseId: string;
  question: 'q1' | 'q2';
}): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: '管理者権限がありません' };
  }
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: '管理者トークンが見つかりません' };
  }

  try {
    const { createAuthedAnonServerClient } = await import('@/lib/supabase/authed-anon-server');
    const supabase = createAuthedAnonServerClient(token);

    const { error } = await supabase.rpc('update_score_distribution', {
      p_case_id: params.caseId,
      p_question: params.question,
    });

    if (error) {
      console.error('updateScoreDistribution error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('updateScoreDistribution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'エラーが発生しました',
    };
  }
}

// 全ケースのスコア分布を一括更新
export async function updateAllScoreDistributions(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!(await isAdmin())) {
    return { success: false, error: '管理者権限がありません' };
  }
  const token = await getAccessToken();
  if (!token) {
    return { success: false, error: '管理者トークンが見つかりません' };
  }

  try {
    const { createAuthedAnonServerClient } = await import('@/lib/supabase/authed-anon-server');
    const supabase = createAuthedAnonServerClient(token);

    const { error } = await supabase.rpc('update_all_score_distributions');

    if (error) {
      console.error('updateAllScoreDistributions error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('updateAllScoreDistributions error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'エラーが発生しました',
    };
  }
}


