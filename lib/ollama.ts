// Thin Ollama client for gemma4:12b (vision + text), JSON-forced.

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'gemma4:12b';

interface GenerateOpts {
  prompt: string;
  images?: string[]; // base64-encoded, WITHOUT the data: URL prefix
  system?: string;
  temperature?: number;
}

/**
 * Call gemma4:12b via Ollama's /api/generate with format=json.
 * Returns the parsed JSON object (model is instructed to emit a single object).
 */
export async function ollamaJSON<T>(opts: GenerateOpts): Promise<T> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: opts.prompt,
      system: opts.system,
      images: opts.images,
      stream: false,
      format: 'json',
      options: {
        temperature: opts.temperature ?? 0.1,
        num_ctx: 8192,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama ${res.status}: ${text || res.statusText}`);
  }

  const data = (await res.json()) as { response?: string };
  const raw = (data.response ?? '').trim();
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Best-effort: pull the first {...} block if the model wrapped it.
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error(`Could not parse model JSON. Raw: ${raw.slice(0, 300)}`);
  }
}

export async function ollamaUp(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

export { OLLAMA_MODEL };
