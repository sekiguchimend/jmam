# セキュリティ対策チェックリスト

## 認証・認可
- [x] セッション管理（有効期限、無効化）
  - Cookie有効期限: 7日間
  - MFA途中セッション: 10分
  - トークンリフレッシュ機能
  - ログアウト時の全Cookie削除
- [x] MFA（多要素認証）
  - TOTP対応（Google Authenticator等）
  - AAL2レベル必須（本番環境）
  - MFA登録・検証フロー完備
- [x] パスワードポリシー
  - 最低8文字、最大128文字
  - 大文字・小文字・数字必須
  - よく使われるパスワードの禁止
  - 連続文字（1234, abcd等）の禁止
- [x] ログイン試行制限
  - 5回失敗で15分間ロックアウト
  - メールアドレスベースのレート制限
  - 成功時にカウンターリセット
- [x] セッション固定攻撃対策
  - ログイン成功時に新トークン発行
  - 古いSupabaseクッキーを削除
  - MFA検証成功時に新セッション発行

## アクセス制御
- [x] レート制限（Rate Limiting）
  - ログイン: 5回失敗で15分ロックアウト
  - API: 100リクエスト/分（IPベース）
  - レート制限ヘッダー（X-RateLimit-*）付与
- [x] RBAC（ロールベースアクセス制御）
  - admin/userロールでDB側で実装
  - RLSポリシーで`auth.jwt() ->> 'role' = 'admin'`チェック
  - middleware.tsで管理者/ユーザー認証分離
- [x] RLS（Row Level Security）
  - 全テーブルでRLS有効（upload_logsは未使用）
  - 詳細: docs/RLS_POLICIES.md参照
- [x] CORS設定
  - 同一オリジンのみ許可
  - OPTIONSプリフライト対応
  - 認証情報付きリクエスト許可
- [x] CSP（Content Security Policy）
  - default-src 'self'
  - frame-ancestors 'none'（クリックジャッキング対策）
  - object-src 'none'
  - Supabase接続のみ許可

## 入力・出力
- [x] XSS対策
  - CSP（Content Security Policy）によるスクリプト実行制限
  - containsDangerousPatterns()による危険パターン検出
  - HTMLタグ（script, iframe, object, embed, link, meta, style）検出
  - イベントハンドラ（onclick等）検出
  - 危険なスキーム（javascript:, data:, vbscript:）検出
  - CSS expression/url(javascript:)検出
- [x] SQLインジェクション対策
  - Supabaseパラメータ化クエリの使用（.eq(), .gte()等）
  - 直接SQL文字列連結なし
  - RPC関数もパラメータ化
- [x] CSRF対策
  - Next.js Server ActionsによるPOSTのみ許可
  - Origin/Hostヘッダー自動検証
  - SameSite=lax Cookieによるクロスサイトリクエスト防止
  - HttpOnly Cookieによるスクリプトアクセス防止
- [x] 入力バリデーション
  - isValidEmail(): RFC 5322準拠のメール検証
  - validatePassword(): パスワードポリシー検証
  - validateUserInput(): XSSパターンチェック
  - validateRole(): ロール値ホワイトリスト検証
- [x] サニタイズ処理
  - sanitizeEmail(): メールアドレスサニタイズ
  - sanitizeDisplayName(): 表示名サニタイズ
  - sanitizeText(): 汎用テキストサニタイズ
  - stripControlChars(): 制御文字除去
  - truncateString(): 長さ制限

## 通信・データ
- [ ] HTTPS強制
- [ ] Cookie属性（HttpOnly, Secure, SameSite）
- [ ] 機密データ暗号化
- [ ] 環境変数管理

## インフラ・運用
- [ ] 依存パッケージ脆弱性
- [ ] エラーメッセージ制御
- [ ] ログ監査
- [ ] セキュリティヘッダー（X-Frame-Options等）

## API
- [ ] API認証
- [ ] リクエストサイズ制限
- [ ] タイムアウト設定
