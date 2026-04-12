import { describe, it, expect } from 'vitest';
import {
  CANCELLED_MESSAGE,
  DISMISSED_MARKER,
  type UploadJobStatus,
  type PrepareStatus,
  type UploadJob,
} from '../uploadJobTypes';

describe('uploadJobTypes', () => {
  describe('constants', () => {
    it('CANCELLED_MESSAGE が定義されている', () => {
      expect(CANCELLED_MESSAGE).toBeDefined();
      expect(typeof CANCELLED_MESSAGE).toBe('string');
      expect(CANCELLED_MESSAGE.length).toBeGreaterThan(0);
    });

    it('DISMISSED_MARKER が定義されている', () => {
      expect(DISMISSED_MARKER).toBeDefined();
      expect(typeof DISMISSED_MARKER).toBe('string');
      expect(DISMISSED_MARKER).toBe('__DISMISSED__');
    });
  });

  describe('types', () => {
    it('UploadJobStatus の有効な値', () => {
      const validStatuses: UploadJobStatus[] = ['pending', 'processing', 'completed', 'error'];

      validStatuses.forEach((status) => {
        expect(['pending', 'processing', 'completed', 'error']).toContain(status);
      });
    });

    it('PrepareStatus の有効な値', () => {
      const validStatuses: PrepareStatus[] = ['pending', 'processing', 'completed', 'skipped'];

      validStatuses.forEach((status) => {
        expect(['pending', 'processing', 'completed', 'skipped']).toContain(status);
      });
    });

    it('UploadJob のインターフェース構造', () => {
      const mockJob: UploadJob = {
        id: 'job-123',
        file_name: 'test.csv',
        file_size: 1024,
        status: 'processing',
        total_rows: 100,
        processed_rows: 50,
        error_message: null,
        errors: [],
        prepare_status: 'pending',
        embedding_processed: 0,
        embedding_succeeded: 0,
        embedding_failed: 0,
        typicals_done: 0,
        typicals_total: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        completed_at: null,
      };

      expect(mockJob.id).toBe('job-123');
      expect(mockJob.file_name).toBe('test.csv');
      expect(mockJob.status).toBe('processing');
      expect(mockJob.total_rows).toBe(100);
      expect(mockJob.processed_rows).toBe(50);
    });

    it('UploadJob のエラー状態', () => {
      const errorJob: UploadJob = {
        id: 'job-456',
        file_name: 'error.csv',
        file_size: 2048,
        status: 'error',
        total_rows: 100,
        processed_rows: 30,
        error_message: 'CSV parsing failed',
        errors: ['行10: 不正なデータ', '行25: 必須項目が空'],
        prepare_status: null,
        embedding_processed: 0,
        embedding_succeeded: 0,
        embedding_failed: 0,
        typicals_done: 0,
        typicals_total: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z',
        completed_at: null,
      };

      expect(errorJob.status).toBe('error');
      expect(errorJob.error_message).toBe('CSV parsing failed');
      expect(errorJob.errors).toHaveLength(2);
    });

    it('UploadJob の完了状態', () => {
      const completedJob: UploadJob = {
        id: 'job-789',
        file_name: 'complete.csv',
        file_size: 4096,
        status: 'completed',
        total_rows: 200,
        processed_rows: 200,
        error_message: null,
        errors: [],
        prepare_status: 'completed',
        embedding_processed: 200,
        embedding_succeeded: 198,
        embedding_failed: 2,
        typicals_done: 10,
        typicals_total: 10,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T02:00:00Z',
        completed_at: '2024-01-01T02:00:00Z',
      };

      expect(completedJob.status).toBe('completed');
      expect(completedJob.prepare_status).toBe('completed');
      expect(completedJob.processed_rows).toBe(completedJob.total_rows);
      expect(completedJob.completed_at).not.toBeNull();
    });

    it('キャンセル状態のチェック', () => {
      const cancelledJob: UploadJob = {
        id: 'job-cancelled',
        file_name: 'cancelled.csv',
        file_size: 1024,
        status: 'error',
        total_rows: 100,
        processed_rows: 25,
        error_message: CANCELLED_MESSAGE,
        errors: [],
        prepare_status: null,
        embedding_processed: 0,
        embedding_succeeded: 0,
        embedding_failed: 0,
        typicals_done: 0,
        typicals_total: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:30:00Z',
        completed_at: null,
      };

      // キャンセル状態の判定
      const isCancelled = cancelledJob.status === 'error' && cancelledJob.error_message === CANCELLED_MESSAGE;
      expect(isCancelled).toBe(true);
    });

    it('dismiss状態のチェック', () => {
      const dismissedJob: UploadJob = {
        id: 'job-dismissed',
        file_name: 'dismissed.csv',
        file_size: 1024,
        status: 'error',
        total_rows: null,
        processed_rows: 0,
        error_message: DISMISSED_MARKER,
        errors: [],
        prepare_status: null,
        embedding_processed: 0,
        embedding_succeeded: 0,
        embedding_failed: 0,
        typicals_done: 0,
        typicals_total: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:30:00Z',
        completed_at: null,
      };

      // dismiss状態の判定
      const isDismissed = dismissedJob.error_message === DISMISSED_MARKER;
      expect(isDismissed).toBe(true);
    });
  });
});
