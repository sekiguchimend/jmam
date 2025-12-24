// JWTユーティリティ（サーバー/クライアント両対応）
// NOTE: 署名検証は行わない（Cookieに入っているJWTのpayloadを読む用途のみ）

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadPart = parts[1];

    // base64url -> base64
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

    // ブラウザ/Edge/Nodeの差異を吸収
    const json =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf-8');

    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getUserIdFromJwt(token: string): string | null {
  const payload = decodeJwtPayload(token);
  const sub = payload?.sub;
  return typeof sub === 'string' && sub.length > 0 ? sub : null;
}

// JWTが有効期限切れかどうかを確認
export function isJwtExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return true;

  const exp = payload.exp;
  if (typeof exp !== 'number') return true;

  // 現在時刻（秒）と比較。少し余裕を持たせる（30秒）
  const nowSec = Math.floor(Date.now() / 1000);
  return exp < nowSec + 30;
}


