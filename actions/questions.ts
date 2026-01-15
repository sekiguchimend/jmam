'use server';

import { isAdmin, getAccessToken } from '@/lib/supabase/server';
import { getQuestionsByCase, upsertQuestion, deleteQuestion } from '@/lib/supabase/queries';
import { embedText } from '@/lib/gemini';
import type { Question } from '@/types';

const EMBEDDING_MODEL = 'models/text-embedding-004';

// 設問一覧を取得
export async function fetchQuestions(caseId: string): Promise<{
  success: boolean;
  questions?: Question[];
  error?: string;
}> {
  try {
    if (!(await isAdmin())) {
      return { success: false, error: '管理者権限がありません' };
    }

    const token = await getAccessToken();
    if (!token) {
      return { success: false, error: '管理者トークンが見つかりません（再ログインしてください）' };
    }

    const questions = await getQuestionsByCase(caseId, token);
    return { success: true, questions };
  } catch (error) {
    console.error('fetchQuestions error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '設問の取得に失敗しました',
    };
  }
}

// 設問を保存（テキスト + embedding同時生成）
export async function saveQuestion(params: {
  caseId: string;
  questionKey: 'q1' | 'q2';
  questionText: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!(await isAdmin())) {
      return { success: false, error: '管理者権限がありません' };
    }

    const { caseId, questionKey, questionText } = params;

    if (!caseId || !questionText.trim()) {
      return { success: false, error: 'ケースIDと設問テキストは必須です' };
    }

    const token = await getAccessToken();
    if (!token) {
      return { success: false, error: '管理者トークンが見つかりません（再ログインしてください）' };
    }

    // 設問テキストをembedding化
    const embeddingResult = await embedText(questionText.trim());
    const embedding = embeddingResult.values;

    // 設問を保存
    await upsertQuestion(
      {
        case_id: caseId,
        question_key: questionKey,
        question_text: questionText.trim(),
        question_embedding: embedding,
        embedding_model: EMBEDDING_MODEL,
      },
      token
    );

    return { success: true };
  } catch (error) {
    console.error('saveQuestion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '設問の保存に失敗しました',
    };
  }
}

// 設問を削除
export async function removeQuestion(params: {
  caseId: string;
  questionKey: 'q1' | 'q2';
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!(await isAdmin())) {
      return { success: false, error: '管理者権限がありません' };
    }

    const { caseId, questionKey } = params;

    if (!caseId) {
      return { success: false, error: 'ケースIDは必須です' };
    }

    const token = await getAccessToken();
    if (!token) {
      return { success: false, error: '管理者トークンが見つかりません（再ログインしてください）' };
    }

    await deleteQuestion(caseId, questionKey, token);

    return { success: true };
  } catch (error) {
    console.error('removeQuestion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '設問の削除に失敗しました',
    };
  }
}
