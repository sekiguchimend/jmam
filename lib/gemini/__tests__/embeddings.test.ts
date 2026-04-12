import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// トップレベルでインポート
import { embedText } from '../embeddings';

describe('embeddings', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // 各テスト前に環境変数をリセット
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('embedText', () => {
    it('APIキーが設定されていない場合はエラー', async () => {
      // 環境変数をクリア
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      await expect(embedText('test')).rejects.toThrow('GEMINI_API_KEY');
    });

    it('GEMINI_API_KEYが設定されている場合は使用される', async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      delete process.env.GOOGLE_API_KEY;

      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          embedding: {
            values: [0.1, 0.2, 0.3],
          },
        }),
      } as Response);

      await embedText('テストテキスト');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('key=test-gemini-key'),
        expect.any(Object)
      );
    });

    it('GOOGLE_API_KEYがフォールバックとして使用される', async () => {
      delete process.env.GEMINI_API_KEY;
      process.env.GOOGLE_API_KEY = 'test-google-key';

      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          embedding: {
            values: [0.1, 0.2, 0.3],
          },
        }),
      } as Response);

      await embedText('テストテキスト');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('key=test-google-key'),
        expect.any(Object)
      );
    });

    it('正常にエンベディングを取得', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      const mockValues = Array.from({ length: 3072 }, () => Math.random());
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          embedding: {
            values: mockValues,
          },
        }),
      } as Response);

      const result = await embedText('テストテキスト');

      expect(result.values).toHaveLength(3072);
      expect(result.values).toEqual(mockValues);
    });

    it('APIエラー時は例外をスロー', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request'),
      } as Response);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(embedText('テストテキスト')).rejects.toThrow('Embedding API error: 400');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('レート制限時（429）は警告ログを出力', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded'),
      } as Response);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(embedText('テストテキスト')).rejects.toThrow('Embedding API error: 429');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('レート制限')
      );
    });

    it('サーバーエラー時（5xx）はエラーログを出力', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service unavailable'),
      } as Response);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(embedText('テストテキスト')).rejects.toThrow('Embedding API error: 503');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('サーバーエラー')
      );
    });

    it('ネットワークエラー時は例外をスロー', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(embedText('テストテキスト')).rejects.toThrow('Embedding API network error');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('レスポンスに embedding.values がない場合はエラー', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          // embedding.values がない
        }),
      } as Response);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(embedText('テストテキスト')).rejects.toThrow('embedding.values が見つかりません');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('正しいリクエストボディを送信', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          embedding: {
            values: [0.1, 0.2, 0.3],
          },
        }),
      } as Response);

      await embedText('テストテキスト');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('テストテキスト'),
        })
      );

      // リクエストボディを検証
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.model).toBe('models/gemini-embedding-001');
      expect(body.output_dimensionality).toBe(3072);
      expect(body.content.parts[0].text).toBe('テストテキスト');
    });
  });
});
