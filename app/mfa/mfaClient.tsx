// MFA（必須）クライアント

'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { startTotpEnroll, verifyTotp, cancelMfa } from '@/actions/mfa';
import { Mail, ShieldCheck, QrCode, AlertCircle, ArrowRight, Loader2, Copy } from 'lucide-react';

type MfaStatus =
  | { ok: false; error: string }
  | { ok: true; email: string; mode: 'needsEnroll' | 'needsVerify'; factorId?: string; redirectTo: string | null };

export function MfaClient({ initial }: { initial: MfaStatus }) {
  const router = useRouter();
  const [status] = useState<MfaStatus>(initial);
  const [code, setCode] = useState('');
  const [enroll, setEnroll] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(initial.ok ? null : initial.error);
  const [isPending, startTransition] = useTransition();

  const effectiveFactorId = useMemo(() => enroll?.factorId ?? (status.ok ? status.factorId : undefined), [enroll, status]);

  // status更新でエラーを自動クリアしない（react-hooks/set-state-in-effect対策）

  const handleStartEnroll = () => {
    startTransition(async () => {
      const res = await startTotpEnroll();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEnroll({ factorId: res.factorId, qrCode: res.qrCode, secret: res.secret });
      setError(null);
    });
  };

  const handleCopySecret = async () => {
    if (!enroll?.secret) return;
    try {
      await navigator.clipboard.writeText(enroll.secret);
    } catch {
      // noop
    }
  };

  const handleVerify = () => {
    const factorId = effectiveFactorId;
    if (!factorId) {
      setError('MFAの準備ができていません。');
      return;
    }
    startTransition(async () => {
      const res = await verifyTotp({ factorId, code });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(res.redirectTo);
      router.refresh();
    });
  };

  const handleCancel = () => {
    startTransition(async () => {
      await cancelMfa();
      router.push('/login');
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      {error && (
        <div
          className="p-4 rounded-lg text-sm font-bold flex items-center gap-3 animate-slide-up"
          style={{ background: 'var(--error-light)', color: '#323232' }}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {status.ok && (
        <div className="rounded-xl p-4" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Mail className="w-5 h-5" style={{ color: '#323232' }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black" style={{ color: 'var(--text-muted)' }}>
                アカウント
              </p>
              <p className="font-black truncate" style={{ color: '#323232' }}>
                {status.email}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* enroll */}
      {status.ok && status.mode === 'needsEnroll' && !enroll && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-start gap-3">
            <QrCode className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--primary)' }} />
            <div>
              <p className="font-black" style={{ color: '#323232' }}>
                まず認証アプリを登録してください
              </p>
              <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
                Google Authenticator / 1Password / Authy 等に対応
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={handleStartEnroll}
            className="w-full py-3 px-4 rounded-lg font-extrabold text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98]"
            style={{ background: 'var(--primary)', color: 'white' }}
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2 font-extrabold">
                <Loader2 className="w-5 h-5 animate-spin" />
                準備中...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2 font-extrabold">
                QRコードを表示
                <ArrowRight className="w-5 h-5" />
              </span>
            )}
          </button>
        </div>
      )}

      {enroll && (
        <div className="rounded-xl p-4 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--primary)' }} />
            <div>
              <p className="font-black" style={{ color: '#323232' }}>
                認証アプリに追加
              </p>
              <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
                QRコードをスキャンして、表示された6桁コードを入力してください
              </p>
            </div>
          </div>

          <div className="rounded-lg p-3 flex items-center justify-center" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
            {/* data URL のSVG/PNGを表示するだけなので img を使用 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={enroll.qrCode} alt="TOTP QR code" className="w-48 h-48" />
          </div>

          <div className="text-xs font-black" style={{ color: 'var(--text-muted)' }}>
            うまくスキャンできない場合は、シークレットを手入力してください：
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg text-xs font-black overflow-x-auto" style={{ background: 'var(--background)', border: '1px solid var(--border)', color: '#323232' }}>
              {enroll.secret}
            </code>
            <button
              type="button"
              onClick={handleCopySecret}
              className="p-2 rounded-lg hover:bg-black/5"
              style={{ border: '1px solid var(--border)', color: '#323232' }}
              aria-label="シークレットをコピー"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* verify */}
      {status.ok && (status.mode === 'needsVerify' || enroll) && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-extrabold mb-2" style={{ color: '#323232' }}>
              認証コード（6桁）
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ''))}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="w-full px-4 py-3 rounded-lg text-base font-bold transition-all"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: '#323232' }}
              placeholder="123456"
            />
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={handleVerify}
            className="w-full py-3 px-4 rounded-lg font-extrabold text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98]"
            style={{ background: 'var(--primary)', color: 'white' }}
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2 font-extrabold">
                <Loader2 className="w-5 h-5 animate-spin" />
                検証中...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2 font-extrabold">
                ログインを完了
                <ArrowRight className="w-5 h-5" />
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="w-full py-3 px-4 rounded-lg font-extrabold text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            キャンセル（ログインに戻る）
          </button>
        </div>
      )}
    </div>
  );
}


