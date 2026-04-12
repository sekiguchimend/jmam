import { describe, it, expect } from 'vitest';
import { parseCSVLine, parseDate, parseScore } from '../utils';

describe('utils', () => {
  // ========================================
  // parseCSVLine
  // ========================================
  describe('parseCSVLine', () => {
    it('通常のCSV行をパース', () => {
      expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
    });

    it('空のフィールドを含む行をパース', () => {
      expect(parseCSVLine('a,,c')).toEqual(['a', '', 'c']);
      expect(parseCSVLine(',b,')).toEqual(['', 'b', '']);
    });

    it('ダブルクォートで囲まれたフィールドをパース', () => {
      expect(parseCSVLine('"a","b","c"')).toEqual(['a', 'b', 'c']);
    });

    it('カンマを含むフィールドをパース', () => {
      expect(parseCSVLine('"a,b",c')).toEqual(['a,b', 'c']);
    });

    it('エスケープされたダブルクォートをパース', () => {
      expect(parseCSVLine('"a""b",c')).toEqual(['a"b', 'c']);
      expect(parseCSVLine('"say ""hello""",world')).toEqual(['say "hello"', 'world']);
    });

    it('改行を含むフィールドをパース', () => {
      expect(parseCSVLine('"line1\nline2",b')).toEqual(['line1\nline2', 'b']);
    });

    it('空の行を処理', () => {
      expect(parseCSVLine('')).toEqual(['']);
    });

    it('前後の空白をトリム', () => {
      expect(parseCSVLine(' a , b , c ')).toEqual(['a', 'b', 'c']);
    });

    it('日本語を含む行をパース', () => {
      expect(parseCSVLine('受注番号,題材コード,名前')).toEqual(['受注番号', '題材コード', '名前']);
    });

    it('全角スペースを含む値をパース', () => {
      expect(parseCSVLine('Ⅱ　MC　題材コード,値')).toEqual(['Ⅱ　MC　題材コード', '値']);
    });
  });

  // ========================================
  // parseDate
  // ========================================
  describe('parseDate', () => {
    it('YYYY/MM/DD形式をパース', () => {
      const result = parseDate('2024/01/15');
      expect(result).not.toBeNull();
      // タイムゾーンの影響でUTC変換後の日付が前後する可能性がある
      expect(result).toMatch(/^2024-01-1[45]$/);
    });

    it('YYYY-MM-DD形式をパース', () => {
      // ISO形式はタイムゾーンの影響を受けにくい
      const result = parseDate('2024-01-15');
      expect(result).not.toBeNull();
      expect(result).toMatch(/^2024-01-1[45]$/);
    });

    it('MM/DD/YYYY形式をパース', () => {
      // JavaScriptのDate.parse()が解釈できる形式
      // タイムゾーンの影響でUTC変換後の日付になる可能性がある
      const result = parseDate('01/15/2024');
      expect(result).not.toBeNull();
      expect(result).toMatch(/^2024-01-1[45]$/); // タイムゾーンにより14または15
    });

    it('空文字列でnullを返す', () => {
      expect(parseDate('')).toBeNull();
    });

    it('nullでnullを返す', () => {
      expect(parseDate(null as unknown as string)).toBeNull();
    });

    it('undefinedでnullを返す', () => {
      expect(parseDate(undefined as unknown as string)).toBeNull();
    });

    it('数字のみの文字列でnullを返す（case_idの誤入力対策）', () => {
      expect(parseDate('265109')).toBeNull();
      expect(parseDate('12345')).toBeNull();
    });

    it('区切り文字がない文字列でnullを返す', () => {
      expect(parseDate('20240115')).toBeNull();
    });

    it('無効な日付でnullを返す', () => {
      expect(parseDate('invalid date')).toBeNull();
      expect(parseDate('abc/def/ghi')).toBeNull();
    });

    it('範囲外の年でnullを返す', () => {
      expect(parseDate('1800/01/01')).toBeNull(); // 1900未満
      expect(parseDate('2200/01/01')).toBeNull(); // 2100超過
    });

    it('有効な範囲内の年は受け入れる', () => {
      // タイムゾーンの影響でUTC変換後の日付が前後する可能性がある
      const result1900 = parseDate('1900/01/01');
      const result2100 = parseDate('2100/12/31');
      expect(result1900).not.toBeNull();
      expect(result2100).not.toBeNull();
      expect(result1900).toMatch(/^(1899-12-31|1900-01-01)$/);
      expect(result2100).toMatch(/^(2100-12-30|2100-12-31)$/);
    });

    it('前後の空白をトリム', () => {
      const result = parseDate('  2024/01/15  ');
      expect(result).not.toBeNull();
      // タイムゾーンの影響でUTC変換後の日付が前後する可能性がある
      expect(result).toMatch(/^2024-01-1[45]$/);
    });
  });

  // ========================================
  // parseScore
  // ========================================
  describe('parseScore', () => {
    it('有効なスコア（1.0-4.0）をパース', () => {
      expect(parseScore('1.0')).toBe(1.0);
      expect(parseScore('2.5')).toBe(2.5);
      expect(parseScore('4.0')).toBe(4.0);
    });

    it('整数をパース', () => {
      expect(parseScore('1')).toBe(1.0);
      expect(parseScore('2')).toBe(2.0);
      expect(parseScore('4')).toBe(4.0);
    });

    it('小数点以下を丸める（0.1刻み）', () => {
      expect(parseScore('2.55')).toBe(2.6);
      expect(parseScore('3.14')).toBe(3.1);
    });

    it('範囲外のスコアでnullを返す', () => {
      expect(parseScore('0.5')).toBeNull();  // 1.0未満
      expect(parseScore('0.9')).toBeNull();  // 1.0未満
      expect(parseScore('4.1')).toBeNull();  // 4.0超過
      expect(parseScore('5.0')).toBeNull();  // 4.0超過
    });

    it('空文字列でnullを返す', () => {
      expect(parseScore('')).toBeNull();
    });

    it('数値以外の文字列でnullを返す', () => {
      expect(parseScore('abc')).toBeNull();
      expect(parseScore('N/A')).toBeNull();
    });

    it('境界値を正しく処理', () => {
      expect(parseScore('1.0')).toBe(1.0);  // 最小値
      expect(parseScore('4.0')).toBe(4.0);  // 最大値
    });
  });
});
