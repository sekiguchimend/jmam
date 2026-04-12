import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() を使用してモック変数をホイスト
const { mockCookies, mockGetMfaPendingTokens } = vi.hoisted(() => ({
  mockCookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => []),
  })),
  mockGetMfaPendingTokens: vi.fn(),
}));

// モック設定
vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      setSession: vi.fn(() => ({ error: null })),
      getUser: vi.fn(() => ({ data: { user: { email: 'test@example.com' } }, error: null })),
      mfa: {
        listFactors: vi.fn(() => ({ data: { totp: [] }, error: null })),
        enroll: vi.fn(() => ({
          data: { id: 'factor-id', totp: { qr_code: 'qr', secret: 'secret' } },
          error: null,
        })),
        challenge: vi.fn(() => ({ data: { id: 'challenge-id' }, error: null })),
        verify: vi.fn(() => ({ data: {}, error: null })),
        getAuthenticatorAssuranceLevel: vi.fn(() => ({
          data: { currentLevel: 'aal2' },
          error: null,
        })),
      },
      getSession: vi.fn(() => ({
        data: { session: { access_token: 'token', refresh_token: 'refresh' } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => ({ data: null, error: null })),
        })),
      })),
    })),
  })),
}));

vi.mock('@/lib/supabase/server', () => ({
  getMfaPendingTokens: mockGetMfaPendingTokens,
  MFA_PENDING_ACCESS_TOKEN_COOKIE: 'mfa_pending_access_token',
  MFA_PENDING_REFRESH_TOKEN_COOKIE: 'mfa_pending_refresh_token',
  MFA_PENDING_IS_ADMIN_COOKIE: 'mfa_pending_is_admin',
  MFA_PENDING_REDIRECT_COOKIE: 'mfa_pending_redirect',
  ADMIN_TOKEN_COOKIE: 'admin_access_token',
  ADMIN_REFRESH_TOKEN_COOKIE: 'admin_refresh_token',
  USER_TOKEN_COOKIE: 'user_access_token',
  USER_REFRESH_TOKEN_COOKIE: 'user_refresh_token',
}));

// トップレベルインポート
import {
  getMfaStatus,
  startTotpEnroll,
  verifyTotp,
  setMfaPendingCookies,
  cancelMfa,
} from '../mfa';

describe('mfa actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMfaStatus', () => {
    it('MFAセッションがない場合はエラー', async () => {
      mockGetMfaPendingTokens.mockResolvedValue(null);

      const result = await getMfaStatus();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('MFAセッションが見つかりません。再ログインしてください。');
      }
    });
  });

  describe('startTotpEnroll', () => {
    it('MFAセッションがない場合はエラー', async () => {
      mockGetMfaPendingTokens.mockResolvedValue(null);

      const result = await startTotpEnroll();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('MFAセッションが見つかりません。再ログインしてください。');
      }
    });
  });

  describe('verifyTotp', () => {
    it('MFAセッションがない場合はエラー', async () => {
      mockGetMfaPendingTokens.mockResolvedValue(null);

      const result = await verifyTotp({ factorId: 'factor-id', code: '123456' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('MFAセッションが見つかりません。再ログインしてください。');
      }
    });

    it('factorIdまたはcodeが空の場合はエラー', async () => {
      mockGetMfaPendingTokens.mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        isAdmin: false,
        redirectTo: '/dashboard',
      });

      // factorIdが空
      const result1 = await verifyTotp({ factorId: '', code: '123456' });
      expect(result1.ok).toBe(false);
      if (!result1.ok) {
        expect(result1.error).toBe('認証コードを入力してください。');
      }

      // codeが空
      const result2 = await verifyTotp({ factorId: 'factor-id', code: '' });
      expect(result2.ok).toBe(false);
      if (!result2.ok) {
        expect(result2.error).toBe('認証コードを入力してください。');
      }
    });
  });

  describe('setMfaPendingCookies', () => {
    it('クッキーが正しく設定される', async () => {
      const mockCookieStore = {
        set: vi.fn(),
        delete: vi.fn(),
      };

      mockCookies.mockResolvedValue(mockCookieStore as never);

      await setMfaPendingCookies({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        isAdmin: true,
        redirectTo: '/admin',
      });

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'mfa_pending_access_token',
        'access-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        })
      );
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'mfa_pending_is_admin',
        '1',
        expect.any(Object)
      );
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'mfa_pending_redirect',
        '/admin',
        expect.any(Object)
      );
    });

    it('redirectToがnullの場合はクッキーを削除', async () => {
      const mockCookieStore = {
        set: vi.fn(),
        delete: vi.fn(),
      };

      mockCookies.mockResolvedValue(mockCookieStore as never);

      await setMfaPendingCookies({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        isAdmin: false,
        redirectTo: null,
      });

      expect(mockCookieStore.delete).toHaveBeenCalledWith('mfa_pending_redirect');
    });
  });

  describe('cancelMfa', () => {
    it('MFA関連クッキーが削除される', async () => {
      const mockCookieStore = {
        delete: vi.fn(),
      };

      mockCookies.mockResolvedValue(mockCookieStore as never);

      await cancelMfa();

      expect(mockCookieStore.delete).toHaveBeenCalledWith('mfa_pending_access_token');
      expect(mockCookieStore.delete).toHaveBeenCalledWith('mfa_pending_refresh_token');
      expect(mockCookieStore.delete).toHaveBeenCalledWith('mfa_pending_is_admin');
      expect(mockCookieStore.delete).toHaveBeenCalledWith('mfa_pending_redirect');
    });
  });
});
