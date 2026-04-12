import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() を使用してモック変数をホイスト
const {
  mockGetAnyAccessToken,
  mockGetAuthedUserId,
  mockGetUserWithRole,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockGetAnyAccessToken: vi.fn(),
  mockGetAuthedUserId: vi.fn(),
  mockGetUserWithRole: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

// モック設定
vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock('@/lib/supabase/server', () => ({
  getAnyAccessToken: mockGetAnyAccessToken,
  getAuthedUserId: mockGetAuthedUserId,
  getUserWithRole: mockGetUserWithRole,
}));

vi.mock('@/lib/supabase/authed-anon-server', () => ({
  createAuthedAnonServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
    })),
  })),
}));

// security.tsは実際の実装を使用
vi.mock('@/lib/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/security')>();
  return actual;
});

// トップレベルインポート
import { updateMyDisplayName } from '../profile';

describe('profile actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateMyDisplayName', () => {
    it('表示名が50文字を超える場合はエラー', async () => {
      const longName = 'a'.repeat(51);
      const formData = new FormData();
      formData.set('name', longName);

      const result = await updateMyDisplayName({ ok: false }, formData);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('表示名は50文字以内で入力してください');
    });

    it('危険なパターン（scriptタグ）を含む場合はエラー', async () => {
      const formData = new FormData();
      formData.set('name', '<script>alert(1)</script>');

      const result = await updateMyDisplayName({ ok: false }, formData);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('使用できない文字が含まれています');
    });

    it('危険なパターン（javascript:）を含む場合はエラー', async () => {
      const formData = new FormData();
      formData.set('name', 'javascript:alert(1)');

      const result = await updateMyDisplayName({ ok: false }, formData);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('使用できない文字が含まれています');
    });

    it('危険なパターン（onclick=）を含む場合はエラー', async () => {
      const formData = new FormData();
      formData.set('name', 'test onclick=alert(1)');

      const result = await updateMyDisplayName({ ok: false }, formData);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('使用できない文字が含まれています');
    });

    it('ログインしていない場合はエラー', async () => {
      mockGetAnyAccessToken.mockResolvedValue(null);
      mockGetAuthedUserId.mockResolvedValue(null);

      const formData = new FormData();
      formData.set('name', '正常な名前');

      const result = await updateMyDisplayName({ ok: false }, formData);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('ログイン状態を確認できませんでした（再ログインしてください）');
    });

    it('正常な表示名は受け入れられる（モック環境）', async () => {
      mockGetAnyAccessToken.mockResolvedValue('mock-token');
      mockGetAuthedUserId.mockResolvedValue('user-123');

      const formData = new FormData();
      formData.set('name', '山田太郎');

      const result = await updateMyDisplayName({ ok: false }, formData);
      expect(result.ok).toBe(true);
      expect(result.name).toBe('山田太郎');
    });

    it('空の表示名は受け入れられる（nullとして保存）', async () => {
      mockGetAnyAccessToken.mockResolvedValue('mock-token');
      mockGetAuthedUserId.mockResolvedValue('user-123');

      const formData = new FormData();
      formData.set('name', '');

      const result = await updateMyDisplayName({ ok: false }, formData);
      expect(result.ok).toBe(true);
      expect(result.name).toBeNull();
    });

    it('前後の空白は除去される', async () => {
      mockGetAnyAccessToken.mockResolvedValue('mock-token');
      mockGetAuthedUserId.mockResolvedValue('user-123');

      const formData = new FormData();
      formData.set('name', '  テスト名前  ');

      const result = await updateMyDisplayName({ ok: false }, formData);
      expect(result.ok).toBe(true);
      expect(result.name).toBe('テスト名前');
    });
  });
});
