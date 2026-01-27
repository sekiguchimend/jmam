// MFA（必須）画面
import { redirect } from 'next/navigation';
import { hasAnyAccessToken, getMfaPendingTokens } from '@/lib/supabase/server';
import { MfaClient } from './mfaClient';
import { getMfaStatus } from '@/actions/mfa';

export const metadata = {
  title: "二段階認証",
};

export default async function MfaPage() {
  // 既にログイン済みなら不要
  if (await hasAnyAccessToken()) {
    redirect('/dashboard');
  }
  const pending = await getMfaPendingTokens();
  if (!pending) {
    redirect('/login');
  }

  const status = await getMfaStatus();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 lg:p-8" style={{ background: 'var(--surface)' }}>
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-6 lg:mb-8">
          <h2 className="text-2xl lg:text-3xl font-black mb-2" style={{ color: '#323232' }}>
            二段階認証（必須）
          </h2>
          <p className="font-bold" style={{ color: '#323232' }}>
            認証アプリのコードでログインを完了してください
          </p>
        </div>

        <MfaClient initial={status} />
      </div>
    </div>
  );
}


