// 管理者：ユーザー追加（インライン）
// - モーダル/オーバーレイなし（操作回数を減らしてUX優先）
// - 自動生成・コピー・表示切替・トーストで「使いやすいギミック」

'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui';
import { adminCreateUser } from '@/actions/adminUsers';
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, Mail, RotateCcw } from 'lucide-react';

function scorePasswordStrength(password: string): { label: string; score: number } {
  let score = 0;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  score = Math.min(score, 4);
  const label = ['弱い', 'ふつう', '良い', '強い', '非常に強い'][score] ?? '弱い';
  return { label, score };
}

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
  const bytes = new Uint32Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 2 ** 32);
  }
  let out = '';
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function Toast({
  message,
  tone,
  onClose,
}: {
  message: string;
  tone: 'success' | 'error';
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 2200);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-[80]">
      <div
        className="px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          color: tone === 'success' ? '#16a34a' : 'var(--error)',
        }}
        role="status"
        aria-live="polite"
      >
        <span className="font-black text-sm">{message}</span>
      </div>
    </div>
  );
}

export function CreateUserInline({
  onCreated,
  disabled,
}: {
  onCreated: () => void;
  disabled?: boolean;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [isPending, startTransition] = useTransition();

  const emailRef = useRef<HTMLInputElement | null>(null);
  const strength = useMemo(() => scorePasswordStrength(password), [password]);

  useEffect(() => {
    const t = setTimeout(() => emailRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  const canSubmit = email.trim().length > 0 && password.trim().length > 0 && !disabled && !isPending;

  const reset = () => {
    setEmail('');
    setName('');
    setPassword('');
    setShowPassword(false);
    setRole('user');
  };

  const ensurePassword = () => {
    if (!password) setPassword(generatePassword());
  };

  const copyPassword = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setToast({ message: 'パスワードをコピーしました', tone: 'success' });
    } catch {
      setToast({ message: 'コピーに失敗しました', tone: 'error' });
    }
  };

  const submit = () => {
    if (!email || !password) {
      setToast({ message: 'メールとパスワードは必須です', tone: 'error' });
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set('email', email.trim());
      fd.set('password', password);
      if (name.trim()) fd.set('name', name.trim());
      fd.set('role', role);
      const result = await adminCreateUser(fd);
      if (!result.success) {
        setToast({ message: result.error ?? 'ユーザー作成に失敗しました', tone: 'error' });
        return;
      }
      setToast({ message: 'ユーザーを追加しました', tone: 'success' });
      onCreated();
      reset();
      // 入力体験優先：連続追加しやすいよう展開は維持
      emailRef.current?.focus();
    });
  };

  return (
    <>
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="px-4 lg:px-6 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-black" style={{ color: '#323232' }}>
            ユーザーを追加
          </p>
          <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
            ここで追加→そのまま一覧が更新されます（最短導線）
          </p>
        </div>

        <div className="px-4 lg:px-6 py-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-black" style={{ color: '#323232' }}>
                  メール
                </span>
                <div
                  className="mt-1 flex items-center gap-2 border rounded-lg px-3 h-11"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <Mail className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <input
                    ref={emailRef}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => {
                      // 迷わせない：初期パスワード未入力なら自動生成
                      ensurePassword();
                    }}
                    type="email"
                    required
                    placeholder="user@example.com"
                    className="w-full outline-none bg-transparent text-sm font-bold h-full"
                    style={{ color: '#323232' }}
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-black" style={{ color: '#323232' }}>
                  権限
                </span>
                <div className="mt-1 border rounded-lg px-3 h-11 flex items-center" style={{ borderColor: 'var(--border)' }}>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value === 'admin' ? 'admin' : 'user')}
                    className="w-full outline-none bg-transparent text-sm font-bold h-full"
                    style={{ color: '#323232' }}
                    disabled={isPending || disabled}
                  >
                    <option value="user">一般ユーザー</option>
                    <option value="admin">管理者</option>
                  </select>
                </div>
              </label>

              <label className="block md:col-span-2">
                <span className="text-xs font-black" style={{ color: '#323232' }}>
                  表示名（任意）
                </span>
                <div className="mt-1 flex items-center gap-2 border rounded-lg px-3 h-11" style={{ borderColor: 'var(--border)' }}>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="未設定も可"
                    className="w-full outline-none bg-transparent text-sm font-bold h-full"
                    style={{ color: '#323232' }}
                    disabled={isPending || disabled}
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-black" style={{ color: '#323232' }}>
                  初期パスワード
                </span>
                <div
                  className="mt-1 flex items-center gap-2 border rounded-lg px-3 h-11"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <KeyRound className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="自動生成 or 入力"
                    className="w-full outline-none bg-transparent text-sm font-bold h-full"
                    style={{ color: '#323232' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="p-1 rounded hover:bg-black/5"
                    aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                    style={{ color: '#323232' }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPassword(generatePassword())}
                    className="px-2 py-1 rounded-lg text-xs font-black border hover:bg-black/5 whitespace-nowrap"
                    style={{ borderColor: 'var(--border)', color: '#323232' }}
                    title="自動生成"
                  >
                    生成
                  </button>
                  <button
                    type="button"
                    onClick={copyPassword}
                    className="p-1 rounded hover:bg-black/5"
                    aria-label="パスワードをコピー"
                    style={{ color: '#323232' }}
                    title="コピー"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                {/* 強度バーは「パスワード欄の直下」に配置 */}
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${(strength.score / 4) * 100}%`,
                        background: strength.score >= 3 ? '#16a34a' : strength.score >= 2 ? '#f59e0b' : 'var(--error)',
                      }}
                    />
                  </div>
                  <span className="text-xs font-black" style={{ color: 'var(--text-muted)' }}>
                    {strength.label}
                  </span>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  reset();
                  setPassword(generatePassword());
                  setToast({ message: '入力をリセットしました', tone: 'success' });
                  emailRef.current?.focus();
                }}
                className="inline-flex items-center gap-2 text-sm font-black underline"
                style={{ color: 'var(--text-muted)' }}
                disabled={isPending || disabled}
              >
                <RotateCcw className="w-4 h-4" />
                リセット
              </button>

              <div className="flex items-center gap-2">
                <Button type="button" onClick={submit} disabled={!canSubmit} isLoading={isPending} className="inline-flex items-center gap-2">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  追加
                </Button>
              </div>
            </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}


