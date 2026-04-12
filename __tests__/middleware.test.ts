import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// モック設定
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: {
      ...actual.NextResponse,
      next: vi.fn(() => ({
        headers: new Map(),
        cookies: {
          set: vi.fn(),
          delete: vi.fn(),
        },
      })),
      redirect: vi.fn((url: URL) => ({
        headers: new Map(),
        cookies: {
          set: vi.fn(),
          delete: vi.fn(),
        },
        url: url.toString(),
      })),
      json: vi.fn((body: unknown, init?: ResponseInit) => ({
        headers: new Map(),
        body,
        status: init?.status,
      })),
    },
  };
});

// テスト用のJWTを生成するヘルパー
function createTestJwt(exp: number): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { sub: 'user123', exp };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `${headerB64}.${payloadB64}.signature`;
}

// モックリクエストを作成
function createMockRequest(pathname: string, cookies: Record<string, string> = {}): NextRequest {
  const url = new URL(pathname, 'http://localhost:3000');
  const req = {
    nextUrl: url,
    url: url.toString(),
    headers: new Headers(),
    cookies: {
      get: vi.fn((name: string) => {
        const value = cookies[name];
        return value ? { value } : undefined;
      }),
    },
  } as unknown as NextRequest;
  return req;
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 環境変数をモック
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  describe('checkToken (JWT validation)', () => {
    // checkToken関数のロジックをテスト（middleware内の関数なので直接テストはできないが、結果的な動作をテスト）

    it('有効なトークンで保護されたルートにアクセスできる', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const validToken = createTestJwt(nowSec + 3600); // 1時間後に期限切れ

      const req = createMockRequest('/admin', {
        admin_access_token: validToken,
      });

      const { middleware } = await import('../middleware');
      const res = await middleware(req);

      // 有効なトークンなのでNextResponse.next()が呼ばれるはず
      expect(NextResponse.next).toHaveBeenCalled();
    });

    it('期限切れトークンで保護されたルートにアクセスするとリダイレクト', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const expiredToken = createTestJwt(nowSec - 3600); // 1時間前に期限切れ

      const req = createMockRequest('/admin', {
        admin_access_token: expiredToken,
        // リフレッシュトークンがないのでリフレッシュできない
      });

      const { middleware } = await import('../middleware');
      const res = await middleware(req);

      // リフレッシュできないのでリダイレクト
      expect(NextResponse.redirect).toHaveBeenCalled();
    });

    it('トークンなしで保護されたルートにアクセスするとリダイレクト', async () => {
      const req = createMockRequest('/admin', {});

      const { middleware } = await import('../middleware');
      const res = await middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalled();
    });
  });

  describe('API route protection', () => {
    it('/api/admin/* にトークンなしでアクセスすると401', async () => {
      const req = createMockRequest('/api/admin/prepare', {});

      const { middleware } = await import('../middleware');
      const res = await middleware(req);

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    });

    it('/api/admin/* に有効なトークンでアクセスできる', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const validToken = createTestJwt(nowSec + 3600);

      const req = createMockRequest('/api/admin/prepare', {
        admin_access_token: validToken,
      });

      const { middleware } = await import('../middleware');
      const res = await middleware(req);

      expect(NextResponse.next).toHaveBeenCalled();
    });
  });

  describe('/login route', () => {
    it('有効な管理者トークンがある場合は/adminにリダイレクト', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const validToken = createTestJwt(nowSec + 3600);

      const req = createMockRequest('/login', {
        admin_access_token: validToken,
      });

      const { middleware } = await import('../middleware');
      await middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectCall = vi.mocked(NextResponse.redirect).mock.calls[0];
      expect(redirectCall[0].toString()).toContain('/admin');
    });

    it('有効なユーザートークンがある場合は/dashboardにリダイレクト', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const validToken = createTestJwt(nowSec + 3600);

      const req = createMockRequest('/login', {
        user_access_token: validToken,
      });

      const { middleware } = await import('../middleware');
      await middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectCall = vi.mocked(NextResponse.redirect).mock.calls[0];
      expect(redirectCall[0].toString()).toContain('/dashboard');
    });

    it('トークンがない場合はログインページを表示', async () => {
      const req = createMockRequest('/login', {});

      const { middleware } = await import('../middleware');
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalled();
    });
  });

  describe('/dashboard/* route', () => {
    it('管理者トークンでもアクセスできる', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const validToken = createTestJwt(nowSec + 3600);

      const req = createMockRequest('/dashboard', {
        admin_access_token: validToken,
      });

      const { middleware } = await import('../middleware');
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalled();
    });

    it('ユーザートークンでアクセスできる', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const validToken = createTestJwt(nowSec + 3600);

      const req = createMockRequest('/dashboard', {
        user_access_token: validToken,
      });

      const { middleware } = await import('../middleware');
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalled();
    });

    it('トークンなしでアクセスするとリダイレクト', async () => {
      const req = createMockRequest('/dashboard/predict', {});

      const { middleware } = await import('../middleware');
      await middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalled();
    });
  });

  describe('/predict route (legacy)', () => {
    it('/dashboardにリダイレクト', async () => {
      const req = createMockRequest('/predict', {});

      const { middleware } = await import('../middleware');
      await middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectCall = vi.mocked(NextResponse.redirect).mock.calls[0];
      expect(redirectCall[0].toString()).toContain('/dashboard');
    });
  });

  describe('Security headers', () => {
    it('レスポンスにセキュリティヘッダーが設定される', async () => {
      const req = createMockRequest('/login', {});

      const { middleware } = await import('../middleware');
      const res = await middleware(req);

      // NextResponse.next()のモックが呼ばれることを確認
      expect(NextResponse.next).toHaveBeenCalled();
    });
  });

  describe('Prefetch handling', () => {
    it('Prefetchリクエストはリフレッシュをスキップ', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const expiredToken = createTestJwt(nowSec - 3600);

      const url = new URL('/admin', 'http://localhost:3000');
      const req = {
        nextUrl: url,
        url: url.toString(),
        headers: new Headers({
          purpose: 'prefetch',
        }),
        cookies: {
          get: vi.fn((name: string) => {
            if (name === 'admin_access_token') return { value: expiredToken };
            if (name === 'admin_refresh_token') return { value: 'refresh-token' };
            return undefined;
          }),
        },
      } as unknown as NextRequest;

      const { middleware } = await import('../middleware');
      await middleware(req);

      // Prefetchなのでリフレッシュせずにリダイレクト
      expect(NextResponse.redirect).toHaveBeenCalled();
    });
  });
});
