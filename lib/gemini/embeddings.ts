// Gemini Embeddings（事前準備: 全回答をエンベディング化）

const EMBED_MODEL = 'models/text-embedding-004';
const EMBED_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';

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
  const body = {
    model: EMBED_MODEL,
    content: {
      parts: [{ text }],
    },
  };

  const res = await fetch(`${EMBED_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`Embedding API error: ${res.status} ${msg}`);
  }

  const data = (await res.json()) as unknown;
  const values = (data as { embedding?: { values?: unknown } })?.embedding?.values;
  if (!Array.isArray(values)) {
    throw new Error('Embedding API response に embedding.values が見つかりません');
  }
  return { values: values.map((v) => Number(v)) };
}


