import { describe, it, expect } from 'vitest';
import {
  stripControlChars,
  truncateString,
  sanitizeText,
  isAllowedRedirect,
  getSafeRedirectUrl,
  getCSPHeader,
  containsDangerousPatterns,
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
});
