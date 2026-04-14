/**
 * セキュリティ対応ロガー
 * 本番環境では機密情報を出力しない
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  /** ログプレフィックス */
  prefix?: string;
  /** 本番環境でも出力するか（error以上は常に出力） */
  forceInProduction?: boolean;
}

const isDev = process.env.NODE_ENV === 'development';

/**
 * 機密情報をマスクする
 */
function maskSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(maskSensitiveData);
  }

  const masked: Record<string, unknown> = {};
  const sensitiveKeys = [
    'password', 'token', 'secret', 'key', 'auth', 'cookie',
    'access_token', 'refresh_token', 'api_key', 'apikey',
    'authorization', 'credential', 'session'
  ];

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk));

    if (isSensitive && typeof value === 'string') {
      // 先頭4文字のみ表示、残りはマスク
      masked[key] = value.length > 4 ? `${value.slice(0, 4)}****` : '****';
    } else if (typeof value === 'object') {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * 構造化ログを出力
 */
function log(level: LogLevel, message: string, data?: unknown, options?: LoggerOptions): void {
  const { prefix, forceInProduction } = options || {};

  // 本番環境ではerror以外はスキップ（forceInProductionがtrueの場合を除く）
  if (!isDev && level !== 'error' && !forceInProduction) {
    return;
  }

  const timestamp = new Date().toISOString();
  const prefixStr = prefix ? `[${prefix}] ` : '';
  const maskedData = data !== undefined ? maskSensitiveData(data) : undefined;

  const logEntry = {
    timestamp,
    level,
    message: `${prefixStr}${message}`,
    ...(maskedData !== undefined && { data: maskedData }),
  };

  switch (level) {
    case 'debug':
      if (isDev) console.debug(JSON.stringify(logEntry));
      break;
    case 'info':
      console.info(JSON.stringify(logEntry));
      break;
    case 'warn':
      console.warn(JSON.stringify(logEntry));
      break;
    case 'error':
      console.error(JSON.stringify(logEntry));
      break;
  }
}

/**
 * セキュリティイベントをログ
 * 認証失敗、不正アクセス試行などのセキュリティ関連イベント用
 */
export function logSecurityEvent(
  event: string,
  details?: Record<string, unknown>
): void {
  log('warn', event, details, { prefix: 'SECURITY', forceInProduction: true });
}

/**
 * 監査ログ
 * 重要な操作（ユーザー作成、削除など）の記録用
 */
export function logAudit(
  action: string,
  userId?: string,
  details?: Record<string, unknown>
): void {
  log('info', action, { userId, ...details }, { prefix: 'AUDIT', forceInProduction: true });
}

/**
 * デバッグログ（開発環境のみ）
 */
export function logDebug(message: string, data?: unknown, prefix?: string): void {
  log('debug', message, data, { prefix });
}

/**
 * 情報ログ
 */
export function logInfo(message: string, data?: unknown, prefix?: string): void {
  log('info', message, data, { prefix });
}

/**
 * 警告ログ
 */
export function logWarn(message: string, data?: unknown, prefix?: string): void {
  log('warn', message, data, { prefix });
}

/**
 * エラーログ（常に出力）
 */
export function logError(message: string, error?: unknown, prefix?: string): void {
  const errorData = error instanceof Error
    ? { name: error.name, message: error.message, stack: isDev ? error.stack : undefined }
    : error;
  log('error', message, errorData, { prefix });
}

export const logger = {
  debug: logDebug,
  info: logInfo,
  warn: logWarn,
  error: logError,
  security: logSecurityEvent,
  audit: logAudit,
};

export default logger;
