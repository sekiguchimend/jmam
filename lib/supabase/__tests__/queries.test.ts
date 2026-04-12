import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() を使用してモック変数をホイスト
const {
  mockServiceRoleFrom,
  mockCreateAuthedAnonServerClient,
  mockGetAccessToken,
} = vi.hoisted(() => ({
  mockServiceRoleFrom: vi.fn(),
  mockCreateAuthedAnonServerClient: vi.fn(),
  mockGetAccessToken: vi.fn(),
}));

// server-only モック
vi.mock('server-only', () => ({}));

// Supabaseクライアントモック
vi.mock('../server', () => ({
  getAccessToken: mockGetAccessToken,
}));

vi.mock('../authed-anon-server', () => ({
  createAuthedAnonServerClient: mockCreateAuthedAnonServerClient,
}));

vi.mock('../service-role', () => ({
  supabaseServiceRole: {
    from: mockServiceRoleFrom,
  },
}));

// トップレベルインポート
import {
  getCases,
  getCaseById,
  findSimilarResponses,
  getDatasetStats,
  getTotalResponseCount,
  upsertCase,
  insertResponses,
  getTypicalExamples,
  getQuestionsByCase,
  upsertQuestion,
  deleteQuestion,
} from '../queries';

describe('queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // getCases (認証必須 - createAuthedAnonServerClient使用)
  // ========================================
  describe('getCases', () => {
    it('トークンがない場合は例外を投げる', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      await expect(getCases()).rejects.toThrow('認証が必要です');
    });

    it('正常にケース一覧を取得', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      const mockCases = [
        { case_id: 'case-1', case_name: 'ケース1', situation_text: 'テスト' },
        { case_id: 'case-2', case_name: 'ケース2', situation_text: 'テスト2' },
      ];

      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: mockCases, error: null }),
          })),
        })),
      });

      const result = await getCases('valid-token');

      expect(result).toHaveLength(2);
      expect(result[0].case_id).toBe('case-1');
    });

    it('エラー時は例外を投げる', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'DB error' },
            }),
          })),
        })),
      });

      await expect(getCases('valid-token')).rejects.toThrow('ケース一覧の取得に失敗しました');
    });

    it('データが空の場合は空配列を返す', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      });

      const result = await getCases('valid-token');

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // getCaseById (認証必須 - createAuthedAnonServerClient使用)
  // ========================================
  describe('getCaseById', () => {
    it('トークンがない場合は例外を投げる', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      await expect(getCaseById('case-1')).rejects.toThrow('認証が必要です');
    });

    it('正常にケースを取得', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      const mockCase = {
        case_id: 'case-1',
        case_name: 'テストケース',
        situation_text: 'テスト',
      };

      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: mockCase, error: null }),
            })),
          })),
        })),
      });

      const result = await getCaseById('case-1', 'valid-token');

      expect(result).toEqual(mockCase);
    });

    it('ケースが見つからない場合はnullを返す', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            })),
          })),
        })),
      });

      const result = await getCaseById('nonexistent', 'valid-token');

      expect(result).toBeNull();
    });

    it('その他のエラー時は例外を投げる', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'OTHER', message: 'Unknown error' },
              }),
            })),
          })),
        })),
      });

      await expect(getCaseById('case-1', 'valid-token')).rejects.toThrow('ケースの取得に失敗しました');
    });
  });

  // ========================================
  // findSimilarResponses (認証必須 - createAuthedAnonServerClient使用)
  // ========================================
  describe('findSimilarResponses', () => {
    it('トークンがない場合は例外を投げる', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      const scores = { problem: 3.5, solution: 3.5, role: 3.5, leadership: 3.5, collaboration: 3.5, development: 3.5 };
      await expect(findSimilarResponses('case-1', scores, 5)).rejects.toThrow('認証が必要です');
    });

    it('正常に類似解答を検索', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      const mockResponses = [
        { id: '1', case_id: 'case-1', score_problem: 3.5 },
        { id: '2', case_id: 'case-1', score_problem: 3.6 },
      ];

      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              gte: vi.fn(() => ({
                lte: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    lte: vi.fn(() => ({
                      gte: vi.fn(() => ({
                        lte: vi.fn(() => ({
                          limit: vi.fn().mockResolvedValue({
                            data: mockResponses,
                            error: null,
                          }),
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
      });

      const scores = { problem: 3.5, solution: 3.5, role: 3.5, leadership: 3.5, collaboration: 3.5, development: 3.5 };
      const result = await findSimilarResponses('case-1', scores, 5, 'valid-token');

      expect(result).toHaveLength(2);
    });
  });

  // ========================================
  // getDatasetStats (認証必須 - createAuthedAnonServerClient使用)
  // ========================================
  describe('getDatasetStats', () => {
    it('トークンがない場合は例外を投げる', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      await expect(getDatasetStats()).rejects.toThrow('認証が必要です');
    });

    it('正常にデータセット統計を取得', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      const mockCases = [
        { case_id: 'case-1', case_name: 'ケース1', file_name: 'test1.csv', created_at: '2024-01-01' },
        { case_id: 'case-2', case_name: 'ケース2', file_name: 'test2.csv', created_at: '2024-01-02' },
      ];
      const mockCounts = [
        { case_id: 'case-1', record_count: 100 },
        { case_id: 'case-2', record_count: 200 },
      ];

      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: mockCases, error: null }),
          })),
        })),
        rpc: vi.fn().mockResolvedValue({ data: mockCounts, error: null }),
      });

      const result = await getDatasetStats('valid-token');

      expect(result).toHaveLength(2);
      expect(result[0].recordCount).toBe(100);
      expect(result[1].recordCount).toBe(200);
    });
  });

  // ========================================
  // getTotalResponseCount (認証必須 - createAuthedAnonServerClient使用)
  // ========================================
  describe('getTotalResponseCount', () => {
    it('トークンがない場合は例外を投げる', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      await expect(getTotalResponseCount()).rejects.toThrow('認証が必要です');
    });

    it('正常に合計数を取得', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockResolvedValue({ count: 500, error: null }),
        })),
      });

      const result = await getTotalResponseCount('valid-token');

      expect(result).toBe(500);
    });

    it('countがnullの場合は0を返す', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockResolvedValue({ count: null, error: null }),
        })),
      });

      const result = await getTotalResponseCount('valid-token');

      expect(result).toBe(0);
    });

    it('エラー時は例外を投げる', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockResolvedValue({
            count: null,
            error: { message: 'DB error' },
          }),
        })),
      });

      await expect(getTotalResponseCount('valid-token')).rejects.toThrow('総解答数の取得に失敗しました');
    });
  });

  // ========================================
  // upsertCase (認証必須 - createAuthedAnonServerClient使用)
  // ========================================
  describe('upsertCase', () => {
    it('トークンがない場合は例外を投げる', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      await expect(
        upsertCase({ case_id: 'case-1' })
      ).rejects.toThrow('管理者トークンが見つかりません');
    });

    it('正常にケースをupsert', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          upsert: vi.fn().mockResolvedValue({ error: null }),
        })),
      });

      await expect(
        upsertCase({ case_id: 'case-1', case_name: 'テスト' }, 'valid-token')
      ).resolves.toBeUndefined();
    });

    it('エラー時は例外を投げる', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          upsert: vi.fn().mockResolvedValue({
            error: { message: 'Upsert error' },
          }),
        })),
      });

      await expect(
        upsertCase({ case_id: 'case-1' }, 'valid-token')
      ).rejects.toThrow('ケースの登録に失敗しました');
    });
  });

  // ========================================
  // insertResponses (認証必須 - createAuthedAnonServerClient使用)
  // ========================================
  describe('insertResponses', () => {
    it('空配列の場合はDB書き込みをスキップ', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          upsert: upsertMock,
        })),
      });

      await expect(insertResponses([])).resolves.toBeUndefined();

      // upsertは呼ばれない（DBへの書き込みが発生しない）
      expect(upsertMock).not.toHaveBeenCalled();
    });

    it('トークンがない場合は例外を投げる', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      await expect(
        insertResponses([{ case_id: 'case-1', response_id: 'r1' }])
      ).rejects.toThrow('管理者トークンが見つかりません');
    });

    it('正常に解答をupsert', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          upsert: vi.fn().mockResolvedValue({ error: null }),
        })),
      });

      await expect(
        insertResponses(
          [{ case_id: 'case-1', response_id: 'r1' }],
          'valid-token'
        )
      ).resolves.toBeUndefined();
    });

    it('重複を除去してupsert', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          upsert: upsertMock,
        })),
      });

      await insertResponses([
        { case_id: 'case-1', response_id: 'r1', answer_q1: 'first' },
        { case_id: 'case-1', response_id: 'r1', answer_q1: 'last' },
      ], 'valid-token');

      // 重複除去後は1件のみ
      expect(upsertMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ response_id: 'r1', answer_q1: 'last' }),
        ]),
        expect.any(Object)
      );
    });
  });

  // ========================================
  // getTypicalExamples (認証必須 - createAuthedAnonServerClient使用)
  // ========================================
  describe('getTypicalExamples', () => {
    it('トークンがない場合は例外を投げる', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      await expect(getTypicalExamples('case-1', 'q1', 3.5)).rejects.toThrow('認証が必要です');
    });

    it('正常に典型例を取得', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      const mockExamples = [
        { case_id: 'case-1', question: 'q1', score_bucket: 3.5, cluster_id: 0, cluster_size: 10, rep_text: 'テスト', rep_score: 3.5 },
      ];

      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue({
                      data: mockExamples,
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          })),
        })),
      });

      const result = await getTypicalExamples('case-1', 'q1', 3.5, 2, 'valid-token');

      expect(result).toHaveLength(1);
    });
  });

  // ========================================
  // getQuestionsByCase (認証必須 - createAuthedAnonServerClient使用)
  // ========================================
  describe('getQuestionsByCase', () => {
    it('トークンがない場合は例外を投げる', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      await expect(getQuestionsByCase('case-1')).rejects.toThrow(
        '管理者トークンが見つかりません'
      );
    });

    it('正常に設問を取得', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      const mockQuestions = [
        { id: '1', case_id: 'case-1', question_key: 'q1', question_text: '設問1' },
        { id: '2', case_id: 'case-1', question_key: 'q2', question_text: '設問2' },
      ];

      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: mockQuestions,
                error: null,
              }),
            })),
          })),
        })),
      });

      const result = await getQuestionsByCase('case-1', 'valid-token');

      expect(result).toHaveLength(2);
    });
  });

  // ========================================
  // upsertQuestion (認証必須 - createAuthedAnonServerClient使用)
  // ========================================
  describe('upsertQuestion', () => {
    it('トークンがない場合は例外を投げる', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      await expect(
        upsertQuestion({
          case_id: 'case-1',
          question_key: 'q1',
          question_text: 'テスト',
          question_embedding: [0.1, 0.2],
          embedding_model: 'test-model',
        })
      ).rejects.toThrow('管理者トークンが見つかりません');
    });

    it('正常に設問を保存', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          upsert: vi.fn().mockResolvedValue({ error: null }),
        })),
      });

      await expect(
        upsertQuestion(
          {
            case_id: 'case-1',
            question_key: 'q1',
            question_text: 'テスト設問',
            question_embedding: [0.1, 0.2, 0.3],
            embedding_model: 'test-model',
          },
          'valid-token'
        )
      ).resolves.toBeUndefined();
    });
  });

  // ========================================
  // deleteQuestion (認証必須 - createAuthedAnonServerClient使用)
  // ========================================
  describe('deleteQuestion', () => {
    it('トークンがない場合は例外を投げる', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      await expect(deleteQuestion('case-1', 'q1')).rejects.toThrow(
        '管理者トークンが見つかりません'
      );
    });

    it('正常に設問を削除', async () => {
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            })),
          })),
        })),
      });

      await expect(
        deleteQuestion('case-1', 'q1', 'valid-token')
      ).resolves.toBeUndefined();
    });
  });
});
