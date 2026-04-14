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

// ========================================
// パスワードポリシー
// ========================================

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * パスワードの複雑性を検証
 * - 最低8文字
 * - 大文字を含む
 * - 小文字を含む
 * - 数字を含む
 * - 特殊文字を含む（オプション）
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password) {
    return { valid: false, errors: ['パスワードを入力してください'] };
  }

  // 最低8文字
  if (password.length < 8) {
    errors.push('8文字以上で入力してください');
  }

  // 最大128文字（DoS対策）
  if (password.length > 128) {
    errors.push('128文字以内で入力してください');
  }

  // 大文字を含む
  if (!/[A-Z]/.test(password)) {
    errors.push('大文字を含めてください');
  }

  // 小文字を含む
  if (!/[a-z]/.test(password)) {
    errors.push('小文字を含めてください');
  }

  // 数字を含む
  if (!/[0-9]/.test(password)) {
    errors.push('数字を含めてください');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * よく使われる脆弱なパスワードリスト
 */
const COMMON_PASSWORDS = [
  'password', 'password1', 'password123',
  '12345678', '123456789', '1234567890',
  'qwerty', 'qwerty123', 'qwertyuiop',
  'abc12345', 'abcd1234',
  'letmein', 'welcome', 'admin', 'login',
  'iloveyou', 'sunshine', 'princess',
  'football', 'baseball', 'soccer',
  'monkey', 'dragon', 'master',
  'michael', 'jennifer', 'jordan',
  'passw0rd', 'p@ssword', 'p@ssw0rd',
];

/**
 * パスワードが一般的すぎないかチェック
 */
export function isCommonPassword(password: string): boolean {
  const lower = password.toLowerCase();
  return COMMON_PASSWORDS.some(common =>
    lower === common || lower.includes(common)
  );
}

/**
 * パスワードに連続した文字列が含まれていないかチェック
 * 例: "aaa", "111", "abc", "123"
 */
export function hasSequentialChars(password: string, minLength: number = 3): boolean {
  if (password.length < minLength) return false;

  for (let i = 0; i <= password.length - minLength; i++) {
    const slice = password.slice(i, i + minLength);

    // 同じ文字の繰り返し (aaa, 111)
    if (new Set(slice).size === 1) return true;

    // 連続した文字 (abc, 123)
    let isSequential = true;
    for (let j = 1; j < slice.length; j++) {
      if (slice.charCodeAt(j) - slice.charCodeAt(j - 1) !== 1) {
        isSequential = false;
        break;
      }
    }
    if (isSequential) return true;

    // 逆順連続 (cba, 321)
    let isReverseSequential = true;
    for (let j = 1; j < slice.length; j++) {
      if (slice.charCodeAt(j - 1) - slice.charCodeAt(j) !== 1) {
        isReverseSequential = false;
        break;
      }
    }
    if (isReverseSequential) return true;
  }

  return false;
}

/**
 * 総合的なパスワード検証
 */
export function validatePassword(password: string): PasswordValidationResult {
  const strengthResult = validatePasswordStrength(password);

  if (!strengthResult.valid) {
    return strengthResult;
  }

  const errors: string[] = [];

  // 一般的なパスワードチェック
  if (isCommonPassword(password)) {
    errors.push('よく使われるパスワードは使用できません');
  }

  // 連続文字チェック
  if (hasSequentialChars(password, 4)) {
    errors.push('連続した文字（例: 1234, abcd）は使用できません');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ========================================
// ログイン試行制限（Rate Limiting）
// ========================================

interface LoginAttempt {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

// メモリ内でログイン試行を追跡（本番環境ではRedis等を推奨）
const loginAttempts = new Map<string, LoginAttempt>();

// 設定
const MAX_LOGIN_ATTEMPTS = 5; // 最大試行回数
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15分間のウィンドウ
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15分間のロックアウト

/**
 * ログイン試行をチェック（レート制限）
 * @param identifier メールアドレスまたはIPアドレス
 * @returns ログイン可能かどうかと、残り時間
 */
export function checkLoginAttempt(identifier: string): {
  allowed: boolean;
  remainingAttempts: number;
  lockedUntil: Date | null;
  message?: string;
} {
  const now = Date.now();
  const attempt = loginAttempts.get(identifier);

  // 初回アクセス
  if (!attempt) {
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS, lockedUntil: null };
  }

  // ロックアウト中
  if (attempt.lockedUntil && now < attempt.lockedUntil) {
    const remainingSeconds = Math.ceil((attempt.lockedUntil - now) / 1000);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: new Date(attempt.lockedUntil),
      message: `ログイン試行回数が上限に達しました。${remainingMinutes}分後に再度お試しください。`,
    };
  }

  // ウィンドウが過ぎていたらリセット
  if (now - attempt.firstAttempt > ATTEMPT_WINDOW_MS) {
    loginAttempts.delete(identifier);
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS, lockedUntil: null };
  }

  // ロックアウト解除後
  if (attempt.lockedUntil && now >= attempt.lockedUntil) {
    loginAttempts.delete(identifier);
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS, lockedUntil: null };
  }

  const remaining = MAX_LOGIN_ATTEMPTS - attempt.count;
  return { allowed: true, remainingAttempts: remaining, lockedUntil: null };
}

/**
 * ログイン失敗を記録
 * @param identifier メールアドレスまたはIPアドレス
 */
export function recordLoginFailure(identifier: string): {
  locked: boolean;
  remainingAttempts: number;
  lockedUntil: Date | null;
} {
  const now = Date.now();
  let attempt = loginAttempts.get(identifier);

  if (!attempt || now - attempt.firstAttempt > ATTEMPT_WINDOW_MS) {
    // 新規または期限切れ
    attempt = { count: 1, firstAttempt: now, lockedUntil: null };
  } else {
    attempt.count++;
  }

  // 最大試行回数に達したらロックアウト
  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    attempt.lockedUntil = now + LOCKOUT_DURATION_MS;
    loginAttempts.set(identifier, attempt);
    return {
      locked: true,
      remainingAttempts: 0,
      lockedUntil: new Date(attempt.lockedUntil),
    };
  }

  loginAttempts.set(identifier, attempt);
  return {
    locked: false,
    remainingAttempts: MAX_LOGIN_ATTEMPTS - attempt.count,
    lockedUntil: null,
  };
}

/**
 * ログイン成功時にカウンターをリセット
 * @param identifier メールアドレスまたはIPアドレス
 */
export function resetLoginAttempts(identifier: string): void {
  loginAttempts.delete(identifier);
}

/**
 * 古いエントリをクリーンアップ（定期実行推奨）
 */
export function cleanupLoginAttempts(): void {
  const now = Date.now();
  for (const [key, attempt] of loginAttempts.entries()) {
    // ロックアウト解除後 or ウィンドウ期限切れなら削除
    const expired = attempt.lockedUntil
      ? now > attempt.lockedUntil
      : now - attempt.firstAttempt > ATTEMPT_WINDOW_MS;
    if (expired) {
      loginAttempts.delete(key);
    }
  }
}
