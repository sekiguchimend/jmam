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
    console.error(`[Gemini] ネットワークエラー (textLen=${textLen}): ${errMsg}`);
    throw new Error(`Embedding API network error: ${errMsg}`);
  }

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    // レート制限やサーバーエラーの詳細をログ出力
    if (res.status === 429) {
      console.warn(`[Gemini] レート制限 (429): textLen=${textLen}`);
    } else if (res.status >= 500) {
      console.error(`[Gemini] サーバーエラー (${res.status}): textLen=${textLen}, msg=${msg.slice(0, 100)}`);
    } else {
      console.error(`[Gemini] APIエラー (${res.status}): textLen=${textLen}, msg=${msg.slice(0, 200)}`);
    }
    throw new Error(`Embedding API error: ${res.status} ${msg.slice(0, 200)}`);
  }

  const data = (await res.json()) as unknown;
  const values = (data as { embedding?: { values?: unknown } })?.embedding?.values;
  if (!Array.isArray(values)) {
    console.error(`[Gemini] レスポンス形式エラー: embedding.values が見つかりません`);
    throw new Error('Embedding API response に embedding.values が見つかりません');
  }
  return { values: values.map((v) => Number(v)) };
}


