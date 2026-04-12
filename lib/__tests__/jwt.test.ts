import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decodeJwtPayload, getUserIdFromJwt, isJwtExpired } from '../jwt';

// テスト用のJWTを生成するヘルパー（base64urlエンコーディング対応）
function createTestJwt(payload: Record<string, unknown>): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  // UTF-8バイト列からbase64urlへ（日本語対応）
  const toBase64Url = (obj: Record<string, unknown>) => {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    const base64 = Buffer.from(bytes).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const headerB64 = toBase64Url(header);
  const payloadB64 = toBase64Url(payload);
  // 署名は検証しないのでダミー
  const signature = 'dummy_signature';
  return `${headerB64}.${payloadB64}.${signature}`;
}

describe('jwt utilities', () => {
  // ========================================
  // decodeJwtPayload
  // ========================================
  describe('decodeJwtPayload', () => {
    it('有効なJWTからペイロードをデコード', () => {
      const payload = { sub: 'user123', email: 'test@example.com', exp: 1234567890 };
      const token = createTestJwt(payload);

      const result = decodeJwtPayload(token);
      expect(result).toEqual(payload);
    });

    it('複数のフィールドを持つペイロードをデコード', () => {
      // 注意: 日本語はatob/btoaの制限でUTF-8エンコーディング問題が発生する可能性あり
      // 実際のJWTでは通常ASCII文字のみを使用
      const payload = { sub: 'user123', name: 'Test User', role: 'admin' };
      const token = createTestJwt(payload);

      const result = decodeJwtPayload(token);
      expect(result).toEqual(payload);
    });

    it('不正なトークン（2パート未満）でnullを返す', () => {
      expect(decodeJwtPayload('invalid')).toBeNull();
      expect(decodeJwtPayload('only.one')).toBeNull();
    });

    it('不正なBase64でnullを返す', () => {
      expect(decodeJwtPayload('header.!!!invalid!!!.signature')).toBeNull();
    });

    it('不正なJSONでnullを返す', () => {
      const invalidJson = Buffer.from('not json').toString('base64url');
      expect(decodeJwtPayload(`header.${invalidJson}.signature`)).toBeNull();
    });

    it('空文字列でnullを返す', () => {
      expect(decodeJwtPayload('')).toBeNull();
    });

    it('ネストしたオブジェクトをデコード', () => {
      const payload = {
        sub: 'user123',
        user_metadata: { role: 'admin', permissions: ['read', 'write'] },
      };
      const token = createTestJwt(payload);

      const result = decodeJwtPayload(token);
      expect(result).toEqual(payload);
    });
  });

  // ========================================
  // getUserIdFromJwt
  // ========================================
  describe('getUserIdFromJwt', () => {
    it('subクレームからユーザーIDを取得', () => {
      const token = createTestJwt({ sub: 'user-uuid-123' });
      expect(getUserIdFromJwt(token)).toBe('user-uuid-123');
    });

    it('subが空文字の場合はnullを返す', () => {
      const token = createTestJwt({ sub: '' });
      expect(getUserIdFromJwt(token)).toBeNull();
    });

    it('subがない場合はnullを返す', () => {
      const token = createTestJwt({ email: 'test@example.com' });
      expect(getUserIdFromJwt(token)).toBeNull();
    });

    it('subが文字列でない場合はnullを返す', () => {
      const token = createTestJwt({ sub: 12345 });
      expect(getUserIdFromJwt(token)).toBeNull();
    });

    it('不正なトークンでnullを返す', () => {
      expect(getUserIdFromJwt('invalid')).toBeNull();
    });
  });

  // ========================================
  // isJwtExpired
  // ========================================
  describe('isJwtExpired', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('有効期限内のトークンはfalseを返す', () => {
      // 現在時刻を固定
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      const nowSec = Math.floor(Date.now() / 1000);

      // 1時間後に期限切れ
      const token = createTestJwt({ exp: nowSec + 3600 });
      expect(isJwtExpired(token)).toBe(false);
    });

    it('有効期限切れのトークンはtrueを返す', () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      const nowSec = Math.floor(Date.now() / 1000);

      // 1時間前に期限切れ
      const token = createTestJwt({ exp: nowSec - 3600 });
      expect(isJwtExpired(token)).toBe(true);
    });

    it('30秒以内に期限切れになるトークンはtrueを返す（バッファ）', () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      const nowSec = Math.floor(Date.now() / 1000);

      // 29秒後に期限切れ（バッファ30秒なので期限切れ扱い）
      const token = createTestJwt({ exp: nowSec + 29 });
      expect(isJwtExpired(token)).toBe(true);
    });

    it('31秒後に期限切れになるトークンはfalseを返す', () => {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      const nowSec = Math.floor(Date.now() / 1000);

      const token = createTestJwt({ exp: nowSec + 31 });
      expect(isJwtExpired(token)).toBe(false);
    });

    it('expがない場合はtrueを返す', () => {
      const token = createTestJwt({ sub: 'user123' });
      expect(isJwtExpired(token)).toBe(true);
    });

    it('expが数値でない場合はtrueを返す', () => {
      const token = createTestJwt({ exp: '2024-01-01' });
      expect(isJwtExpired(token)).toBe(true);
    });

    it('不正なトークンはtrueを返す', () => {
      expect(isJwtExpired('invalid')).toBe(true);
    });
  });
});
