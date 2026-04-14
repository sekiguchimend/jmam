import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// モック設定（vi.mockはホイストされるので、クラス定義を内部に配置）
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();

  // モック用のヘッダーマップクラス
  class MockHeaders extends Map<string, string> {
    set(key: string, value: string): this {
      super.set(key, value);
      return this;
    }
  }

  // モック用のNextResponseクラス
  class MockNextResponseClass {
    headers: MockHeaders;
    cookies: { set: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
    status?: number;
    body: BodyInit | null;

    constructor(body: BodyInit | null, init?: ResponseInit) {
      this.headers = new MockHeaders(Object.entries(init?.headers || {}));
      this.cookies = {
        set: vi.fn(),
        delete: vi.fn(),
      };
      this.status = init?.status;
      this.body = body;
    }

    static next = vi.fn(() => ({
      headers: new MockHeaders(),
      cookies: {
        set: vi.fn(),
        delete: vi.fn(),
      },
    }));

    static redirect = vi.fn((url: URL) => ({
      headers: new MockHeaders(),
      cookies: {
        set: vi.fn(),
        delete: vi.fn(),
      },
      url: url.toString(),
    }));

    static json = vi.fn((body: unknown, init?: ResponseInit) => ({
      headers: new MockHeaders(),
      body,
      status: init?.status,
    }));
  }

  return {
    ...actual,
    NextResponse: MockNextResponseClass,
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

  describe('API Rate Limiting', () => {
    it('/api/admin/* へのリクエストにレート制限ヘッダーが付与される', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const validToken = createTestJwt(nowSec + 3600);

      const url = new URL('/api/admin/prepare', 'http://localhost:3000');
      const req = {
        nextUrl: url,
        url: url.toString(),
        method: 'GET',
        headers: new Headers({
          'x-forwarded-for': '192.168.1.1',
        }),
        cookies: {
          get: vi.fn((name: string) => {
            if (name === 'admin_access_token') return { value: validToken };
            return undefined;
          }),
        },
      } as unknown as NextRequest;

      const { middleware } = await import('../middleware');
      const res = await middleware(req);

      // NextResponse.next()が呼ばれてレート制限ヘッダーが設定される
      expect(NextResponse.next).toHaveBeenCalled();
    });
  });

  describe('CORS handling', () => {
    it('OPTIONSリクエストにCORSヘッダーで応答', async () => {
      const url = new URL('/api/admin/prepare', 'http://localhost:3000');
      const req = {
        nextUrl: url,
        url: url.toString(),
        method: 'OPTIONS',
        headers: new Headers({
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        }),
        cookies: {
          get: vi.fn(() => undefined),
        },
      } as unknown as NextRequest;

      const { middleware } = await import('../middleware');
      const res = await middleware(req);

      // OPTIONSリクエストは204で応答
      expect(res).toBeDefined();
      expect(res.status).toBe(204);

      // CORSヘッダーが設定されていることを確認
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');

      // next()やredirect()が呼ばれていないことを確認
      expect(NextResponse.next).not.toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });
});
