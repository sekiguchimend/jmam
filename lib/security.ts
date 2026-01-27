/**
 * セキュリティユーティリティ
 * XSS対策、入力検証、リダイレクト検証などのセキュリティ関連関数
 */

/**
 * 制御文字を除去（NULL文字やその他の不正な制御文字）
 */
export function stripControlChars(str: string | null | undefined): string {
  if (str == null) return '';
  // ASCII制御文字（0x00-0x1F, 0x7F）を除去（タブ、改行、CRは許可）
  return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * 文字列の最大長を制限
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength);
}

/**
 * 安全なテキスト入力処理（サニタイズ + 長さ制限）
 */
export function sanitizeText(
  value: string | null | undefined,
  maxLength: number = 10000
): string {
  const stripped = stripControlChars(value?.trim());
  return truncateString(stripped, maxLength);
}

// ========================================
// リダイレクト検証
// ========================================

/**
 * 許可されたリダイレクト先のプレフィックス
 * Open Redirect攻撃を防ぐために、相対パスのみを許可
 */
const ALLOWED_REDIRECT_PREFIXES = [
  '/admin',
  '/dashboard',
  '/profile',
  '/mfa',
  '/login',
];

/**
 * リダイレクトURLが安全かどうかを検証
 * - 相対パスのみを許可（//で始まるprotocol-relative URLは拒否）
 * - 許可リストに含まれるパスプレフィックスのみを許可
 * - 外部URLや javascript: スキームなどは拒否
 */
export function isAllowedRedirect(url: string | null | undefined): boolean {
  if (!url) return false;

  const trimmed = url.trim();

  // 空文字は拒否
  if (!trimmed) return false;

  // 絶対URLや危険なスキームを拒否
  // - // で始まるprotocol-relative URL
  // - http:// や https:// で始まる外部URL
  // - javascript:, data:, vbscript: などの危険なスキーム
  if (
    trimmed.startsWith('//') ||
    trimmed.toLowerCase().startsWith('http:') ||
    trimmed.toLowerCase().startsWith('https:') ||
    trimmed.toLowerCase().startsWith('javascript:') ||
    trimmed.toLowerCase().startsWith('data:') ||
    trimmed.toLowerCase().startsWith('vbscript:') ||
    trimmed.includes('\n') ||
    trimmed.includes('\r')
  ) {
    return false;
  }

  // 相対パス（/で始まる）のみを許可
  if (!trimmed.startsWith('/')) {
    return false;
  }

  // 許可リストのプレフィックスに一致するか確認
  return ALLOWED_REDIRECT_PREFIXES.some(
    (prefix) => trimmed === prefix || trimmed.startsWith(prefix + '/')
  );
}

/**
 * 安全なリダイレクトURLを取得
 * - 許可されたURLの場合はそのまま返す
 * - 許可されていない場合はデフォルトのURLを返す
 */
export function getSafeRedirectUrl(
  url: string | null | undefined,
  isAdmin: boolean
): string {
  const defaultUrl = isAdmin ? '/admin' : '/dashboard';

  if (!url) return defaultUrl;

  const trimmed = url.trim();
  if (!trimmed) return defaultUrl;

  // 許可されたURLかどうかを検証
  if (isAllowedRedirect(trimmed)) {
    return trimmed;
  }

  // 許可されていない場合はデフォルトを返す
  return defaultUrl;
}

// ========================================
// Content Security Policy
// ========================================

/**
 * CSPヘッダー値を生成
 * XSS攻撃の影響範囲を制限するためのContent Security Policy
 */
export function getCSPHeader(): string {
  const directives = [
    // デフォルトは自サイトのみ
    "default-src 'self'",
    // スクリプトは自サイトのみ（Next.jsのインラインスクリプト用にunsafe-inlineが必要）
    // 'unsafe-eval' は開発モード用
    process.env.NODE_ENV === 'production'
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    // スタイルは自サイトのみ（インラインスタイル用）
    "style-src 'self' 'unsafe-inline'",
    // 画像は自サイト + data: URL（QRコード等）+ Supabase Storage
    "img-src 'self' data: blob: https://*.supabase.co",
    // フォントは自サイトのみ
    "font-src 'self'",
    // API接続は自サイト + Supabase
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    // フレームは禁止（クリックジャッキング対策）
    "frame-ancestors 'none'",
    // フォームの送信先は自サイトのみ
    "form-action 'self'",
    // base-uriは自サイトのみ
    "base-uri 'self'",
    // objectは禁止
    "object-src 'none'",
  ];

  return directives.join('; ');
}

// ========================================
// 入力バリデーション
// ========================================

/**
 * 入力値が危険なパターンを含んでいないかチェック
 * SQLインジェクションやXSSのペイロードパターンを検出
 */
export function containsDangerousPatterns(value: string): boolean {
  const dangerousPatterns = [
    /<script\b/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick=, onerror= など
    /data:/i,
    /vbscript:/i,
  ];

  return dangerousPatterns.some((pattern) => pattern.test(value));
}
