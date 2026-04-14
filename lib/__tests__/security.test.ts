import { describe, it, expect, beforeEach } from 'vitest';
import {
  stripControlChars,
  truncateString,
  sanitizeText,
  isAllowedRedirect,
  getSafeRedirectUrl,
  getCSPHeader,
  containsDangerousPatterns,
  validatePasswordStrength,
  validatePassword,
  isCommonPassword,
  hasSequentialChars,
  checkLoginAttempt,
  recordLoginFailure,
  resetLoginAttempts,
} from '../security';

describe('security utilities', () => {
  // ========================================
  // stripControlChars
  // ========================================
  describe('stripControlChars', () => {
    it('null/undefinedを空文字に変換', () => {
      expect(stripControlChars(null)).toBe('');
      expect(stripControlChars(undefined)).toBe('');
    });

    it('通常の文字列はそのまま返す', () => {
      expect(stripControlChars('hello')).toBe('hello');
      expect(stripControlChars('日本語テスト')).toBe('日本語テスト');
    });

    it('タブ・改行・CRは保持される', () => {
      expect(stripControlChars('hello\tworld')).toBe('hello\tworld');
      expect(stripControlChars('hello\nworld')).toBe('hello\nworld');
      expect(stripControlChars('hello\rworld')).toBe('hello\rworld');
    });

    it('NULL文字（0x00）を除去', () => {
      expect(stripControlChars('hel\x00lo')).toBe('hello');
    });

    it('制御文字（0x01-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F）を除去', () => {
      expect(stripControlChars('a\x01b\x08c')).toBe('abc');
      expect(stripControlChars('a\x0Bb\x0Cc')).toBe('abc');
      expect(stripControlChars('a\x0Eb\x1Fc')).toBe('abc');
      expect(stripControlChars('a\x7Fb')).toBe('ab');
    });

    it('複数の制御文字を一度に除去', () => {
      expect(stripControlChars('\x00\x01hello\x1F\x7Fworld')).toBe('helloworld');
    });
  });

  // ========================================
  // truncateString
  // ========================================
  describe('truncateString', () => {
    it('maxLength以下の文字列はそのまま返す', () => {
      expect(truncateString('hello', 10)).toBe('hello');
      expect(truncateString('hello', 5)).toBe('hello');
    });

    it('maxLengthを超える文字列は切り詰める', () => {
      expect(truncateString('hello world', 5)).toBe('hello');
      expect(truncateString('abcdefg', 3)).toBe('abc');
    });

    it('空文字列を処理', () => {
      expect(truncateString('', 10)).toBe('');
    });

    it('maxLength=0の場合は空文字を返す', () => {
      expect(truncateString('hello', 0)).toBe('');
    });

    it('マルチバイト文字を正しく処理', () => {
      expect(truncateString('あいうえお', 3)).toBe('あいう');
    });
  });

  // ========================================
  // sanitizeText
  // ========================================
  describe('sanitizeText', () => {
    it('null/undefinedを空文字に変換', () => {
      expect(sanitizeText(null)).toBe('');
      expect(sanitizeText(undefined)).toBe('');
    });

    it('前後の空白を除去', () => {
      expect(sanitizeText('  hello  ')).toBe('hello');
      expect(sanitizeText('\t\nhello\n\t')).toBe('hello');
    });

    it('制御文字を除去', () => {
      expect(sanitizeText('hel\x00lo')).toBe('hello');
    });

    it('デフォルトで10000文字に制限', () => {
      const longString = 'a'.repeat(15000);
      expect(sanitizeText(longString).length).toBe(10000);
    });

    it('カスタムmaxLengthを適用', () => {
      expect(sanitizeText('hello world', 5)).toBe('hello');
    });

    it('複合処理（trim + 制御文字除去 + 長さ制限）', () => {
      const input = '  \x00hello\x01world\x00  ';
      expect(sanitizeText(input, 8)).toBe('hellowor');
    });
  });

  // ========================================
  // isAllowedRedirect
  // ========================================
  describe('isAllowedRedirect', () => {
    describe('許可されるURL', () => {
      it('/admin を許可', () => {
        expect(isAllowedRedirect('/admin')).toBe(true);
      });

      it('/admin/xxx を許可', () => {
        expect(isAllowedRedirect('/admin/users')).toBe(true);
        expect(isAllowedRedirect('/admin/settings/general')).toBe(true);
      });

      it('/dashboard を許可', () => {
        expect(isAllowedRedirect('/dashboard')).toBe(true);
      });

      it('/dashboard/xxx を許可', () => {
        expect(isAllowedRedirect('/dashboard/predict')).toBe(true);
      });

      it('/profile を許可', () => {
        expect(isAllowedRedirect('/profile')).toBe(true);
      });

      it('/mfa を許可', () => {
        expect(isAllowedRedirect('/mfa')).toBe(true);
      });

      it('/login を許可', () => {
        expect(isAllowedRedirect('/login')).toBe(true);
      });
    });

    describe('拒否されるURL', () => {
      it('null/undefinedを拒否', () => {
        expect(isAllowedRedirect(null)).toBe(false);
        expect(isAllowedRedirect(undefined)).toBe(false);
      });

      it('空文字を拒否', () => {
        expect(isAllowedRedirect('')).toBe(false);
        expect(isAllowedRedirect('   ')).toBe(false);
      });

      it('外部URLを拒否', () => {
        expect(isAllowedRedirect('https://evil.com')).toBe(false);
        expect(isAllowedRedirect('http://evil.com')).toBe(false);
        expect(isAllowedRedirect('HTTPS://EVIL.COM')).toBe(false);
      });

      it('protocol-relative URLを拒否', () => {
        expect(isAllowedRedirect('//evil.com')).toBe(false);
        expect(isAllowedRedirect('//evil.com/admin')).toBe(false);
      });

      it('javascriptスキームを拒否', () => {
        expect(isAllowedRedirect('javascript:alert(1)')).toBe(false);
        expect(isAllowedRedirect('JAVASCRIPT:alert(1)')).toBe(false);
      });

      it('dataスキームを拒否', () => {
        expect(isAllowedRedirect('data:text/html,<script>alert(1)</script>')).toBe(false);
      });

      it('vbscriptスキームを拒否', () => {
        expect(isAllowedRedirect('vbscript:msgbox(1)')).toBe(false);
      });

      it('改行を含むURLを拒否', () => {
        expect(isAllowedRedirect('/admin\nSet-Cookie: evil=value')).toBe(false);
        expect(isAllowedRedirect('/admin\r\nLocation: evil.com')).toBe(false);
      });

      it('相対パスでないURLを拒否', () => {
        expect(isAllowedRedirect('admin')).toBe(false);
        expect(isAllowedRedirect('./admin')).toBe(false);
        expect(isAllowedRedirect('../admin')).toBe(false);
      });

      it('許可リストにないパスを拒否', () => {
        expect(isAllowedRedirect('/api')).toBe(false);
        expect(isAllowedRedirect('/unknown')).toBe(false);
        expect(isAllowedRedirect('/')).toBe(false);
      });

      it('/admin-evil のような部分一致を拒否', () => {
        expect(isAllowedRedirect('/admin-evil')).toBe(false);
        expect(isAllowedRedirect('/dashboard-fake')).toBe(false);
      });
    });
  });

  // ========================================
  // getSafeRedirectUrl
  // ========================================
  describe('getSafeRedirectUrl', () => {
    describe('管理者の場合', () => {
      it('null/undefinedの場合は/adminを返す', () => {
        expect(getSafeRedirectUrl(null, true)).toBe('/admin');
        expect(getSafeRedirectUrl(undefined, true)).toBe('/admin');
      });

      it('空文字の場合は/adminを返す', () => {
        expect(getSafeRedirectUrl('', true)).toBe('/admin');
        expect(getSafeRedirectUrl('   ', true)).toBe('/admin');
      });

      it('許可されたURLはそのまま返す', () => {
        expect(getSafeRedirectUrl('/admin/users', true)).toBe('/admin/users');
        expect(getSafeRedirectUrl('/dashboard', true)).toBe('/dashboard');
      });

      it('許可されていないURLは/adminを返す', () => {
        expect(getSafeRedirectUrl('https://evil.com', true)).toBe('/admin');
        expect(getSafeRedirectUrl('javascript:alert(1)', true)).toBe('/admin');
      });
    });

    describe('一般ユーザーの場合', () => {
      it('null/undefinedの場合は/dashboardを返す', () => {
        expect(getSafeRedirectUrl(null, false)).toBe('/dashboard');
        expect(getSafeRedirectUrl(undefined, false)).toBe('/dashboard');
      });

      it('許可されていないURLは/dashboardを返す', () => {
        expect(getSafeRedirectUrl('https://evil.com', false)).toBe('/dashboard');
      });
    });
  });

  // ========================================
  // getCSPHeader
  // ========================================
  describe('getCSPHeader', () => {
    it('CSPヘッダー文字列を返す', () => {
      const csp = getCSPHeader();
      expect(typeof csp).toBe('string');
      expect(csp.length).toBeGreaterThan(0);
    });

    it('必須ディレクティブを含む', () => {
      const csp = getCSPHeader();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
    });

    it('Supabase接続を許可', () => {
      const csp = getCSPHeader();
      expect(csp).toContain('https://*.supabase.co');
    });
  });

  // ========================================
  // containsDangerousPatterns
  // ========================================
  describe('containsDangerousPatterns', () => {
    describe('危険なパターンを検出', () => {
      it('<script>タグを検出', () => {
        expect(containsDangerousPatterns('<script>alert(1)</script>')).toBe(true);
        expect(containsDangerousPatterns('<SCRIPT>alert(1)</SCRIPT>')).toBe(true);
        expect(containsDangerousPatterns('<script src="evil.js">')).toBe(true);
      });

      it('javascript:スキームを検出', () => {
        expect(containsDangerousPatterns('javascript:alert(1)')).toBe(true);
        expect(containsDangerousPatterns('JAVASCRIPT:alert(1)')).toBe(true);
      });

      it('イベントハンドラを検出', () => {
        expect(containsDangerousPatterns('onclick=alert(1)')).toBe(true);
        expect(containsDangerousPatterns('onerror = alert(1)')).toBe(true);
        expect(containsDangerousPatterns('onmouseover=evil()')).toBe(true);
        expect(containsDangerousPatterns('ONCLICK=alert(1)')).toBe(true);
      });

      it('data:スキームを検出', () => {
        expect(containsDangerousPatterns('data:text/html,<script>alert(1)</script>')).toBe(true);
      });

      it('vbscript:スキームを検出', () => {
        expect(containsDangerousPatterns('vbscript:msgbox(1)')).toBe(true);
      });
    });

    describe('安全なパターン', () => {
      it('通常のテキストは検出しない', () => {
        expect(containsDangerousPatterns('Hello World')).toBe(false);
        expect(containsDangerousPatterns('This is a test.')).toBe(false);
      });

      it('scriptという単語だけでは検出しない', () => {
        expect(containsDangerousPatterns('This is a script example')).toBe(false);
        expect(containsDangerousPatterns('JavaScript is great')).toBe(false);
      });

      it('onで始まる通常の単語は検出しない', () => {
        expect(containsDangerousPatterns('online')).toBe(false);
        expect(containsDangerousPatterns('once upon a time')).toBe(false);
      });

      it('日本語テキストは検出しない', () => {
        expect(containsDangerousPatterns('これはテストです')).toBe(false);
        expect(containsDangerousPatterns('データを保存する')).toBe(false);
      });
    });
  });

  // ========================================
  // パスワードポリシー
  // ========================================
  describe('validatePasswordStrength', () => {
    it('空のパスワードはエラー', () => {
      const result = validatePasswordStrength('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('パスワードを入力してください');
    });

    it('8文字未満はエラー', () => {
      const result = validatePasswordStrength('Abc123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('8文字以上で入力してください');
    });

    it('128文字超はエラー', () => {
      const longPassword = 'Abc123!@' + 'a'.repeat(125);
      const result = validatePasswordStrength(longPassword);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('128文字以内で入力してください');
    });

    it('大文字がないとエラー', () => {
      const result = validatePasswordStrength('abcdefgh1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('大文字を含めてください');
    });

    it('小文字がないとエラー', () => {
      const result = validatePasswordStrength('ABCDEFGH1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('小文字を含めてください');
    });

    it('数字がないとエラー', () => {
      const result = validatePasswordStrength('Abcdefgh');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('数字を含めてください');
    });

    it('要件を全て満たすパスワードは有効', () => {
      const result = validatePasswordStrength('Abcdefg1');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('複雑なパスワードは有効', () => {
      const result = validatePasswordStrength('MyP@ssw0rd!2024');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('isCommonPassword', () => {
    it('一般的なパスワードを検出', () => {
      expect(isCommonPassword('password')).toBe(true);
      expect(isCommonPassword('PASSWORD')).toBe(true);
      expect(isCommonPassword('password123')).toBe(true);
      expect(isCommonPassword('12345678')).toBe(true);
      expect(isCommonPassword('qwerty')).toBe(true);
      expect(isCommonPassword('admin')).toBe(true);
    });

    it('一般的なパスワードを含むものを検出', () => {
      expect(isCommonPassword('mypassword2024')).toBe(true);
      expect(isCommonPassword('adminuser')).toBe(true);
    });

    it('安全なパスワードは検出しない', () => {
      expect(isCommonPassword('Xk9#mPqr2Lz')).toBe(false);
      expect(isCommonPassword('UniqueP@ss99')).toBe(false);
    });
  });

  describe('hasSequentialChars', () => {
    it('同じ文字の繰り返しを検出', () => {
      expect(hasSequentialChars('aaa', 3)).toBe(true);
      expect(hasSequentialChars('111', 3)).toBe(true);
      expect(hasSequentialChars('passaaaa', 4)).toBe(true);
    });

    it('連続した文字を検出', () => {
      expect(hasSequentialChars('abc', 3)).toBe(true);
      expect(hasSequentialChars('123', 3)).toBe(true);
      expect(hasSequentialChars('test1234', 4)).toBe(true);
    });

    it('逆順連続を検出', () => {
      expect(hasSequentialChars('cba', 3)).toBe(true);
      expect(hasSequentialChars('321', 3)).toBe(true);
    });

    it('非連続は検出しない', () => {
      expect(hasSequentialChars('ace', 3)).toBe(false);
      expect(hasSequentialChars('135', 3)).toBe(false);
      expect(hasSequentialChars('Xk9mPq', 3)).toBe(false);
    });

    it('短い文字列は検出しない', () => {
      expect(hasSequentialChars('ab', 3)).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('強度チェックに失敗するとエラー', () => {
      const result = validatePassword('weak');
      expect(result.valid).toBe(false);
    });

    it('一般的なパスワードはエラー', () => {
      const result = validatePassword('Password123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('よく使われるパスワードは使用できません');
    });

    it('連続文字を含むパスワードはエラー', () => {
      const result = validatePassword('MyPass1234X');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('連続した文字（例: 1234, abcd）は使用できません');
    });

    it('安全なパスワードは有効', () => {
      const result = validatePassword('Xk9#mPqr2Lz');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ========================================
  // ログイン試行制限
  // ========================================
  describe('Rate Limiting', () => {
    const testEmail = 'test-rate-limit@example.com';

    beforeEach(() => {
      // 各テスト前にリセット
      resetLoginAttempts(testEmail);
    });

    describe('checkLoginAttempt', () => {
      it('初回アクセスは許可', () => {
        const result = checkLoginAttempt(testEmail);
        expect(result.allowed).toBe(true);
        expect(result.remainingAttempts).toBe(5);
        expect(result.lockedUntil).toBeNull();
      });

      it('未知のidentifierは許可', () => {
        const result = checkLoginAttempt('unknown@example.com');
        expect(result.allowed).toBe(true);
      });
    });

    describe('recordLoginFailure', () => {
      it('失敗を記録すると残り回数が減る', () => {
        const result1 = recordLoginFailure(testEmail);
        expect(result1.locked).toBe(false);
        expect(result1.remainingAttempts).toBe(4);

        const result2 = recordLoginFailure(testEmail);
        expect(result2.locked).toBe(false);
        expect(result2.remainingAttempts).toBe(3);
      });

      it('5回失敗するとロックアウト', () => {
        for (let i = 0; i < 4; i++) {
          recordLoginFailure(testEmail);
        }

        const result = recordLoginFailure(testEmail);
        expect(result.locked).toBe(true);
        expect(result.remainingAttempts).toBe(0);
        expect(result.lockedUntil).not.toBeNull();
      });

      it('ロックアウト後はアクセス拒否', () => {
        for (let i = 0; i < 5; i++) {
          recordLoginFailure(testEmail);
        }

        const check = checkLoginAttempt(testEmail);
        expect(check.allowed).toBe(false);
        expect(check.message).toContain('ログイン試行回数が上限に達しました');
      });
    });

    describe('resetLoginAttempts', () => {
      it('リセット後は再度アクセス可能', () => {
        for (let i = 0; i < 5; i++) {
          recordLoginFailure(testEmail);
        }

        expect(checkLoginAttempt(testEmail).allowed).toBe(false);

        resetLoginAttempts(testEmail);

        const result = checkLoginAttempt(testEmail);
        expect(result.allowed).toBe(true);
        expect(result.remainingAttempts).toBe(5);
      });
    });
  });
});
