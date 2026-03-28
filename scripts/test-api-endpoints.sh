#!/bin/bash
#
# APIエンドポイントのテストスクリプト
#
# 使い方:
#   chmod +x scripts/test-api-endpoints.sh
#   ./scripts/test-api-endpoints.sh
#
# 環境変数:
#   BASE_URL - デフォルト: http://localhost:3000
#   AUTH_TOKEN - 管理者のJWTトークン（オプション）
#

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "╔════════════════════════════════════════════════════════════╗"
echo "║              APIエンドポイント テスト                       ║"
echo "║              $(date '+%Y-%m-%d %H:%M:%S')                               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "BASE_URL: $BASE_URL"
echo ""

# ========================================
# ヘルスチェック
# ========================================

echo "=========================================="
echo "1. ヘルスチェック"
echo "=========================================="

# サーバーが起動しているか
echo -n "サーバー接続... "
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" | grep -q "200\|301\|302"; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAILED${NC}"
  echo "サーバーが起動していない可能性があります"
  exit 1
fi

# ========================================
# 認証なしでアクセス可能なエンドポイント
# ========================================

echo ""
echo "=========================================="
echo "2. 公開エンドポイント"
echo "=========================================="

# robots.txt
echo -n "GET /robots.txt ... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/robots.txt")
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}$HTTP_CODE OK${NC}"
else
  echo -e "${RED}$HTTP_CODE${NC}"
fi

# 管理者ログインページ
echo -n "GET /admin/login ... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin/login")
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}$HTTP_CODE OK${NC}"
else
  echo -e "${YELLOW}$HTTP_CODE (リダイレクトの可能性)${NC}"
fi

# ========================================
# 認証が必要なエンドポイント（未認証テスト）
# ========================================

echo ""
echo "=========================================="
echo "3. 認証必須エンドポイント（未認証でアクセス）"
echo "=========================================="

# 管理者ダッシュボード
echo -n "GET /admin (未認証) ... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L "$BASE_URL/admin")
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${YELLOW}$HTTP_CODE (リダイレクトでログインページ表示?)${NC}"
elif [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "307" ]; then
  echo -e "${GREEN}$HTTP_CODE リダイレクト (正常)${NC}"
else
  echo -e "${RED}$HTTP_CODE${NC}"
fi

# ダッシュボード
echo -n "GET /dashboard (未認証) ... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L "$BASE_URL/dashboard")
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${YELLOW}$HTTP_CODE (リダイレクトでログインページ表示?)${NC}"
elif [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "307" ]; then
  echo -e "${GREEN}$HTTP_CODE リダイレクト (正常)${NC}"
else
  echo -e "${RED}$HTTP_CODE${NC}"
fi

# アップロードAPI（未認証）
echo -n "POST /api/admin/upload (未認証) ... "
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/admin/upload")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo -e "${GREEN}$HTTP_CODE 認証エラー (正常)${NC}"
else
  echo -e "${YELLOW}$HTTP_CODE${NC}"
fi

# ========================================
# APIレスポンス形式テスト
# ========================================

echo ""
echo "=========================================="
echo "4. APIレスポンス形式"
echo "=========================================="

# 事前準備API（未認証）
echo -n "POST /api/admin/prepare/embeddings (未認証) ... "
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/admin/prepare/embeddings")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n -1)
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo -e "${GREEN}$HTTP_CODE 認証エラー (正常)${NC}"
else
  echo -e "${YELLOW}$HTTP_CODE${NC}"
fi

echo -n "POST /api/admin/prepare/typical (未認証) ... "
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/admin/prepare/typical")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo -e "${GREEN}$HTTP_CODE 認証エラー (正常)${NC}"
else
  echo -e "${YELLOW}$HTTP_CODE${NC}"
fi

# ========================================
# 認証付きテスト（トークンがある場合）
# ========================================

if [ -n "$AUTH_TOKEN" ]; then
  echo ""
  echo "=========================================="
  echo "5. 認証付きテスト"
  echo "=========================================="

  echo -n "GET /admin (認証付き) ... "
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    "$BASE_URL/admin")
  echo "$HTTP_CODE"

  echo -n "POST /api/admin/upload (認証付き, 空ボディ) ... "
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    "$BASE_URL/api/admin/upload")
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n -1)
  echo "$HTTP_CODE"
  if [ -n "$BODY" ]; then
    echo "  Response: $BODY"
  fi

else
  echo ""
  echo "=========================================="
  echo "5. 認証付きテスト (スキップ)"
  echo "=========================================="
  echo "AUTH_TOKEN が設定されていないためスキップします"
  echo ""
  echo "認証付きテストを実行するには:"
  echo "  export AUTH_TOKEN='your-jwt-token'"
  echo "  ./scripts/test-api-endpoints.sh"
fi

# ========================================
# サマリー
# ========================================

echo ""
echo "=========================================="
echo "テスト完了"
echo "=========================================="
echo ""
echo "詳細なデバッグには以下を実行:"
echo "  npx tsx scripts/debug-upload-system.ts"
echo ""
echo "スタックしたジョブのクリーンアップ:"
echo "  npx tsx scripts/debug-upload-system.ts --cleanup"
echo ""
