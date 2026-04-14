// Gemini Embeddings（事前準備: 全解答をエンベディング化）

const EMBED_MODEL = 'models/gemini-embedding-001';
const EMBED_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';

type EmbedResult = {
  values: number[];
};

function getApiKey(): string {
  // 既存コードの揺れを吸収（GEMINI_API_KEY を優先）
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  if (!key) throw new Error('GEMINI_API_KEY (または GOOGLE_API_KEY) が設定されていません');
  return key;
}

export async function embedText(text: string): Promise<EmbedResult> {
  const apiKey = getApiKey();
  const textLen = text.length;
  const body = {
    model: EMBED_MODEL,
    content: {
      parts: [{ text }],
    },
    output_dimensionality: 3072,
  };

  let res: Response;
  try {
    res = await fetch(`${EMBED_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    // セキュリティ: 内部エラー詳細はログのみ
    console.error(`[Gemini] ネットワークエラー (textLen=${textLen}): ${errMsg}`);
    throw new Error('Embedding APIへの接続に失敗しました');
  }

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    // セキュリティ: 内部エラー詳細はログのみ、throwには汎用メッセージ
    if (res.status === 429) {
      console.warn(`[Gemini] レート制限 (429): textLen=${textLen}`);
      throw new Error('APIリクエストが制限されています。しばらく待ってから再試行してください');
    } else if (res.status >= 500) {
      console.error(`[Gemini] サーバーエラー (${res.status}): textLen=${textLen}, msg=${msg.slice(0, 100)}`);
      throw new Error('Embedding APIでサーバーエラーが発生しました');
    } else {
      console.error(`[Gemini] APIエラー (${res.status}): textLen=${textLen}, msg=${msg.slice(0, 200)}`);
      throw new Error('Embedding APIでエラーが発生しました');
    }
  }

  const data = (await res.json()) as unknown;
  const values = (data as { embedding?: { values?: unknown } })?.embedding?.values;
  if (!Array.isArray(values)) {
    console.error(`[Gemini] レスポンス形式エラー: embedding.values が見つかりません`);
    throw new Error('Embedding API response に embedding.values が見つかりません');
  }
  return { values: values.map((v) => Number(v)) };
}


