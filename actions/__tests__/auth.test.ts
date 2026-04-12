import { describe, it, expect, vi, beforeEach } from 'vitest';

// Server Actions のテストでは、外部依存をモック化してバリデーションロジックを検証

// server-only モック
vi.mock('server-only', () => ({}));

// モック設定
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => []),
  })),
  headers: vi.fn(() => ({
    get: vi.fn((name: string) => {
      if (name === 'host') return 'localhost:3000';
      return null;
    }),
  })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
  getAccessToken: vi.fn(),
  ADMIN_TOKEN_COOKIE: 'admin_access_token',
  ADMIN_REFRESH_TOKEN_COOKIE: 'admin_refresh_token',
  USER_TOKEN_COOKIE: 'user_access_token',
  USER_REFRESH_TOKEN_COOKIE: 'user_refresh_token',
  MFA_PENDING_ACCESS_TOKEN_COOKIE: 'mfa_pending_access_token',
  MFA_PENDING_REFRESH_TOKEN_COOKIE: 'mfa_pending_refresh_token',
  MFA_PENDING_IS_ADMIN_COOKIE: 'mfa_pending_is_admin',
  MFA_PENDING_REDIRECT_COOKIE: 'mfa_pending_redirect',
}));

vi.mock('@/lib/supabase/authed-anon-server', () => ({
  createAuthedAnonServerClient: vi.fn(),
}));

vi.mock('@/lib/supabase/service-role', () => ({
  supabaseServiceRole: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

vi.mock('@/actions/mfa', () => ({
  setMfaPendingCookies: vi.fn(),
}));

// トップレベルでインポート（動的インポートではなく）
import { login, createAdminUser, changePassword, changeEmail } from '../auth';

describe('auth actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login validation', () => {
    it('メールアドレスが空の場合はエラー', async () => {
      const formData = new FormData();
      formData.set('email', '');
      formData.set('password', 'password123');

      const result = await login(formData);
      expect(result.success).toBe(false);
      expect(result.error).toBe('メールアドレスを入力してください');
    });

    it('パスワードが空の場合はエラー', async () => {
      const formData = new FormData();
      formData.set('email', 'test@example.com');
      formData.set('password', '');

      const result = await login(formData);
      expect(result.success).toBe(false);
      expect(result.error).toBe('パスワードを入力してください');
    });
  });

  describe('createAdminUser validation', () => {
    it('メールアドレスとパスワードが空の場合はエラー', async () => {
      const formData = new FormData();
      formData.set('email', '');
      formData.set('password', '');

      const result = await createAdminUser(formData);
      expect(result.success).toBe(false);
      expect(result.error).toBe('メールアドレスとパスワードを入力してください');
    });
  });

  describe('changePassword validation', () => {
    it('現在のパスワードが空の場合はエラー', async () => {
      const result = await changePassword('', 'newPassword123');
      expect(result.success).toBe(false);
      expect(result.error).toBe('現在のパスワードを入力してください');
    });

    it('新しいパスワードが空の場合はエラー', async () => {
      const result = await changePassword('currentPassword', '');
      expect(result.success).toBe(false);
      expect(result.error).toBe('新しいパスワードを入力してください');
    });

    it('新しいパスワードが8文字未満の場合はエラー', async () => {
      const result = await changePassword('currentPassword', 'short');
      expect(result.success).toBe(false);
      expect(result.error).toBe('新しいパスワードは8文字以上で入力してください');
    });

    it('新旧パスワードが同じ場合はエラー', async () => {
      const result = await changePassword('samePassword123', 'samePassword123');
      expect(result.success).toBe(false);
      expect(result.error).toBe('新しいパスワードは現在のパスワードと異なるものを入力してください');
    });
  });

  describe('changeEmail validation', () => {
    it('新しいメールアドレスが空の場合はエラー', async () => {
      const result = await changeEmail('', 'password123');
      expect(result.success).toBe(false);
      expect(result.error).toBe('新しいメールアドレスを入力してください');
    });

    it('メールアドレスに@が含まれない場合はエラー', async () => {
      const result = await changeEmail('invalidemail', 'password123');
      expect(result.success).toBe(false);
      expect(result.error).toBe('有効なメールアドレスを入力してください');
    });

    it('パスワードが空の場合はエラー', async () => {
      const result = await changeEmail('new@example.com', '');
      expect(result.success).toBe(false);
      expect(result.error).toBe('パスワードを入力してください');
    });
  });
});
