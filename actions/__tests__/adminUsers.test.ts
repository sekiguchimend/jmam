import { describe, it, expect, vi, beforeEach } from 'vitest';

// モック設定
vi.mock('@/lib/supabase/server', () => ({
  hasAccessToken: vi.fn(),
  getAccessToken: vi.fn(),
  getAuthedUserId: vi.fn(),
}));

vi.mock('@/lib/supabase/anon-server', () => ({
  supabaseAnonServer: {
    auth: {
      signUp: vi.fn(),
    },
  },
}));

vi.mock('@/lib/supabase/service-role', () => ({
  supabaseServiceRole: {
    auth: {
      admin: {
        deleteUser: vi.fn(),
      },
    },
  },
}));

vi.mock('@/lib/supabase/authed-anon-server', () => ({
  createAuthedAnonServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => ({ data: null, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null })),
      })),
      upsert: vi.fn(() => ({ error: null })),
    })),
    rpc: vi.fn(() => ({
      data: [],
      error: null,
    })),
  })),
}));

describe('adminUsers actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureAdmin authorization', () => {
    it('管理者トークンがない場合はエラー', async () => {
      const { hasAccessToken } = await import('@/lib/supabase/server');
      vi.mocked(hasAccessToken).mockResolvedValue(false);

      const { adminListUsers } = await import('../adminUsers');

      await expect(adminListUsers()).rejects.toThrow('管理者権限が必要です');
    }, 10000); // タイムアウトを10秒に延長
  });

  describe('adminSetUserAdmin', () => {
    it('自分自身の管理者権限は外せない', async () => {
      const { hasAccessToken, getAccessToken, getAuthedUserId } = await import('@/lib/supabase/server');
      vi.mocked(hasAccessToken).mockResolvedValue(true);
      vi.mocked(getAccessToken).mockResolvedValue('mock-token');
      vi.mocked(getAuthedUserId).mockResolvedValue('current-user-id');

      const { adminSetUserAdmin } = await import('../adminUsers');

      const result = await adminSetUserAdmin({
        userId: 'current-user-id',
        makeAdmin: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('自分自身の管理者権限は外せません');
    });
  });

  describe('adminSetUserStatus', () => {
    it('自分自身は停止できない', async () => {
      const { hasAccessToken, getAccessToken, getAuthedUserId } = await import('@/lib/supabase/server');
      vi.mocked(hasAccessToken).mockResolvedValue(true);
      vi.mocked(getAccessToken).mockResolvedValue('mock-token');
      vi.mocked(getAuthedUserId).mockResolvedValue('current-user-id');

      const { adminSetUserStatus } = await import('../adminUsers');

      const result = await adminSetUserStatus({
        userId: 'current-user-id',
        status: 'suspended',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('自分自身は停止/再開できません');
    });
  });

  describe('adminDeleteUser', () => {
    it('自分自身は消去できない', async () => {
      const { hasAccessToken, getAccessToken, getAuthedUserId } = await import('@/lib/supabase/server');
      vi.mocked(hasAccessToken).mockResolvedValue(true);
      vi.mocked(getAccessToken).mockResolvedValue('mock-token');
      vi.mocked(getAuthedUserId).mockResolvedValue('current-user-id');

      const { adminDeleteUser } = await import('../adminUsers');

      const result = await adminDeleteUser({ userId: 'current-user-id' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('自分自身は消去できません');
    });

    it('管理者ユーザーは消去できない', async () => {
      const { hasAccessToken, getAccessToken, getAuthedUserId } = await import('@/lib/supabase/server');
      const { createAuthedAnonServerClient } = await import('@/lib/supabase/authed-anon-server');

      vi.mocked(hasAccessToken).mockResolvedValue(true);
      vi.mocked(getAccessToken).mockResolvedValue('mock-token');
      vi.mocked(getAuthedUserId).mockResolvedValue('admin-user-id');

      // 管理者ユーザーが見つかるモック
      vi.mocked(createAuthedAnonServerClient).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'admin_users') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(() => ({
                      data: { id: 'target-user-id' },
                      error: null,
                    })),
                  })),
                })),
              })),
            };
          }
          return {
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({ error: null })),
            })),
          };
        }),
        rpc: vi.fn(),
      } as unknown as ReturnType<typeof createAuthedAnonServerClient>);

      const { adminDeleteUser } = await import('../adminUsers');

      const result = await adminDeleteUser({ userId: 'target-user-id' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('管理者ユーザーは消去できません（先に管理者権限を外してください）');
    });
  });

  describe('adminCreateUser validation', () => {
    it('メールアドレスとパスワードが空の場合はエラー', async () => {
      const { hasAccessToken, getAccessToken } = await import('@/lib/supabase/server');
      vi.mocked(hasAccessToken).mockResolvedValue(true);
      vi.mocked(getAccessToken).mockResolvedValue('mock-token');

      const { adminCreateUser } = await import('../adminUsers');

      const formData = new FormData();
      formData.set('email', '');
      formData.set('password', '');

      const result = await adminCreateUser(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('メールアドレスとパスワードを入力してください');
    });
  });
});
