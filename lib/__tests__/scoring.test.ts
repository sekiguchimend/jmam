import { describe, it, expect, vi } from 'vitest';

// server-onlyとSupabase関連のモックを設定
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/authed-anon-server', () => ({
  createAuthedAnonServerClient: vi.fn(),
}));
vi.mock('@/lib/gemini/embeddings', () => ({
  embedText: vi.fn(),
}));
vi.mock('@/lib/scoring-prompt', () => ({
  generateAIScoring: vi.fn(),
  performEarlyQualityCheck: vi.fn(),
}));

import {
  normalizeScore,
  normalizeMainScore,
  normalizeDetailScore,
  toScoreBucket,
} from '../scoring';

describe('scoring', () => {
  // ========================================
  // normalizeScore
  // ========================================
  describe('normalizeScore', () => {
    it('指定された刻みと上限に合わせてスコアを正規化', () => {
      // 刻み0.5、上限5、下限1の場合
      expect(normalizeScore(3.3, 0.5, 5, 1)).toBe(3.5);
      expect(normalizeScore(3.2, 0.5, 5, 1)).toBe(3.0);
    });

    it('上限でクランプ', () => {
      expect(normalizeScore(6.0, 0.5, 5, 1)).toBe(5.0);
      expect(normalizeScore(10.0, 0.5, 5, 1)).toBe(5.0);
    });

    it('下限でクランプ', () => {
      expect(normalizeScore(0.5, 0.5, 5, 1)).toBe(1.0);
      expect(normalizeScore(-1.0, 0.5, 5, 1)).toBe(1.0);
    });

    it('nullの場合はnullを返す', () => {
      expect(normalizeScore(null, 0.5, 5, 1)).toBeNull();
    });

    it('undefinedの場合はnullを返す', () => {
      expect(normalizeScore(undefined, 0.5, 5, 1)).toBeNull();
    });

    it('NaNの場合はnullを返す', () => {
      expect(normalizeScore(NaN, 0.5, 5, 1)).toBeNull();
    });

    it('Infinityの場合はnullを返す', () => {
      expect(normalizeScore(Infinity, 0.5, 5, 1)).toBeNull();
      expect(normalizeScore(-Infinity, 0.5, 5, 1)).toBeNull();
    });

    it('刻み1の場合は整数に丸める', () => {
      expect(normalizeScore(2.3, 1, 4, 1)).toBe(2);
      expect(normalizeScore(2.7, 1, 4, 1)).toBe(3);
    });

    it('刻み0.1の場合は小数第1位に丸める', () => {
      expect(normalizeScore(3.33, 0.1, 5, 1)).toBeCloseTo(3.3, 10);
      expect(normalizeScore(3.37, 0.1, 5, 1)).toBeCloseTo(3.4, 10);
    });

    it('デフォルト下限は1', () => {
      // 下限を省略した場合、デフォルトは1
      expect(normalizeScore(0.5, 0.5, 5)).toBe(1.0);
    });
  });

  // ========================================
  // normalizeMainScore
  // ========================================
  describe('normalizeMainScore', () => {
    it('problem（問題把握）スコアを正規化（刻み0.5、上限5）', () => {
      expect(normalizeMainScore('problem', 3.3)).toBe(3.5);
      expect(normalizeMainScore('problem', 3.2)).toBe(3.0);
      expect(normalizeMainScore('problem', 5.5)).toBe(5.0);
      expect(normalizeMainScore('problem', 0.5)).toBe(1.0);
    });

    it('solution（対策立案）スコアを正規化（刻み0.5、上限5）', () => {
      expect(normalizeMainScore('solution', 4.2)).toBe(4.0);
      expect(normalizeMainScore('solution', 4.3)).toBe(4.5);
    });

    it('role（役割理解）スコアを正規化（刻み0.1、上限5）', () => {
      expect(normalizeMainScore('role', 3.33)).toBeCloseTo(3.3, 10);
      expect(normalizeMainScore('role', 3.37)).toBeCloseTo(3.4, 10);
    });

    it('leadership（主導）スコアを正規化（刻み0.5、上限5）', () => {
      expect(normalizeMainScore('leadership', 3.7)).toBe(3.5);
      expect(normalizeMainScore('leadership', 3.8)).toBe(4.0);
    });

    it('collaboration（連携）スコアを正規化（刻み0.5、上限5）', () => {
      expect(normalizeMainScore('collaboration', 2.2)).toBe(2.0);
      expect(normalizeMainScore('collaboration', 2.3)).toBe(2.5);
    });

    it('development（育成）スコアを正規化（刻み0.5、上限5）', () => {
      expect(normalizeMainScore('development', 4.6)).toBe(4.5);
      expect(normalizeMainScore('development', 4.8)).toBe(5.0);
    });

    it('nullの場合はnullを返す', () => {
      expect(normalizeMainScore('problem', null)).toBeNull();
      expect(normalizeMainScore('solution', undefined)).toBeNull();
    });
  });

  // ========================================
  // normalizeDetailScore
  // ========================================
  describe('normalizeDetailScore', () => {
    it('詳細スコアを正規化（刻み1、上限4）', () => {
      expect(normalizeDetailScore(2.3)).toBe(2);
      expect(normalizeDetailScore(2.7)).toBe(3);
      expect(normalizeDetailScore(3.5)).toBe(4);
    });

    it('上限4でクランプ', () => {
      expect(normalizeDetailScore(5.0)).toBe(4);
      expect(normalizeDetailScore(10.0)).toBe(4);
    });

    it('下限1でクランプ', () => {
      expect(normalizeDetailScore(0.5)).toBe(1);
      expect(normalizeDetailScore(-1.0)).toBe(1);
    });

    it('nullの場合はnullを返す', () => {
      expect(normalizeDetailScore(null)).toBeNull();
      expect(normalizeDetailScore(undefined)).toBeNull();
    });

    it('境界値テスト', () => {
      expect(normalizeDetailScore(1.0)).toBe(1);
      expect(normalizeDetailScore(4.0)).toBe(4);
      expect(normalizeDetailScore(1.5)).toBe(2);
      expect(normalizeDetailScore(3.4)).toBe(3);
    });
  });

  // ========================================
  // toScoreBucket
  // ========================================
  describe('toScoreBucket', () => {
    it('スコアを0.5刻みのバケットに変換', () => {
      expect(toScoreBucket(3.3)).toBe(3.5);
      expect(toScoreBucket(3.2)).toBe(3.0);
      expect(toScoreBucket(3.25)).toBe(3.5);
    });

    it('上限5.0でクランプ', () => {
      expect(toScoreBucket(5.5)).toBe(5.0);
      expect(toScoreBucket(10.0)).toBe(5.0);
    });

    it('下限0.0でクランプ', () => {
      expect(toScoreBucket(-1.0)).toBe(0.0);
      expect(toScoreBucket(-0.5)).toBe(0.0);
    });

    it('NaNの場合は0を返す', () => {
      expect(toScoreBucket(NaN)).toBe(0);
    });

    it('Infinityの場合は0を返す', () => {
      expect(toScoreBucket(Infinity)).toBe(0);
      expect(toScoreBucket(-Infinity)).toBe(0);
    });

    it('整数値はそのまま返す', () => {
      expect(toScoreBucket(1)).toBe(1.0);
      expect(toScoreBucket(2)).toBe(2.0);
      expect(toScoreBucket(3)).toBe(3.0);
      expect(toScoreBucket(4)).toBe(4.0);
      expect(toScoreBucket(5)).toBe(5.0);
    });

    it('0.5の倍数はそのまま返す', () => {
      expect(toScoreBucket(1.5)).toBe(1.5);
      expect(toScoreBucket(2.5)).toBe(2.5);
      expect(toScoreBucket(3.5)).toBe(3.5);
      expect(toScoreBucket(4.5)).toBe(4.5);
    });
  });
});
