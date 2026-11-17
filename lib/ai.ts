// Hosted model client. Requests go through Vercel AI Gateway: a plain
// "provider/model" string is routed there by the AI SDK, authenticated with
// AI_GATEWAY_API_KEY, or with the deployment's OIDC token when running on Vercel.

import { generateText, Output } from 'ai';
import type { z } from 'zod';

/**
 * Model used when AI_GATEWAY_MODEL is not set. It must accept image input, and
 * the ID must match an entry in the gateway's model list exactly.
 */
export const DEFAULT_MODEL = 'flint-v1.0';

interface ModelJSONOpts<S extends z.ZodType> {
  instructions: string;
  prompt: string;
  schema: S;
  /** Optional image, base64-encoded WITHOUT the data: URL prefix. */
  image?: { base64: string; mediaType: string };
  temperature?: number;
  timeoutMs?: number;
}

/** Ask the model for one object matching `schema`. Throws if it can't produce one. */
export async function modelJSON<S extends z.ZodType>(opts: ModelJSONOpts<S>): Promise<z.infer<S>> {
  const model = process.env.AI_GATEWAY_MODEL?.trim() || DEFAULT_MODEL;

  const result = await generateText({
    model,
    instructions: opts.instructions,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: opts.prompt },
          ...(opts.image
            ? [{ type: 'file' as const, mediaType: opts.image.mediaType, data: opts.image.base64 }]
            : []),
        ],
      },
    ],
    output: Output.object({ schema: opts.schema }),
    temperature: opts.temperature ?? 0.1,
    timeout: opts.timeoutMs ?? 45_000,
    maxRetries: 1,
  });

  return result.output as z.infer<S>;
}

/** Walk wrapped errors (retries, causes) to find the gateway's error type and status. */
function gatewayFailure(err: unknown): { type?: string; status?: number; name?: string } {
  const seen = new Set<unknown>();
  let cur: unknown = err;
  let name: string | undefined;
  while (cur && typeof cur === 'object' && !seen.has(cur)) {
    seen.add(cur);
    const e = cur as { type?: unknown; statusCode?: unknown; name?: unknown; cause?: unknown; lastError?: unknown };
    name ??= typeof e.name === 'string' ? e.name : undefined;
    if (typeof e.type === 'string' || typeof e.statusCode === 'number') {
      return {
        type: typeof e.type === 'string' ? e.type : undefined,
        status: typeof e.statusCode === 'number' ? e.statusCode : undefined,
        name,
      };
    }
    cur = e.lastError ?? e.cause;
  }
  return { name };
}

/**
 * A message that is safe to show a user and says which kind of failure it was.
 * It names configuration problems but never includes provider output; the full
 * error goes to the server log.
 */
export function modelErrorMessage(err: unknown): string {
  console.error('[PillID] model call failed:', err);
  const model = process.env.AI_GATEWAY_MODEL?.trim() || DEFAULT_MODEL;
  const { type, status, name } = gatewayFailure(err);

  if (type === 'model_not_found') {
    return `AI Gateway has no model called "${model}". Set AI_GATEWAY_MODEL to an exact ID from the gateway's model list.`;
  }
  if (type === 'authentication_error' || status === 401) {
    return 'AI Gateway rejected this app’s credentials. Enable AI Gateway for the Vercel project, or set AI_GATEWAY_API_KEY.';
  }
  if (status === 402) {
    return 'AI Gateway has no credit or budget left for this request.';
  }
  if (type === 'forbidden' || status === 403) {
    return 'AI Gateway refused this request. The Vercel account may need a payment method, or the model may be restricted.';
  }
  if (type === 'rate_limit_exceeded' || status === 429) {
    return 'The model is rate-limited right now. Please try again in a minute.';
  }
  if (type === 'invalid_request_error' || status === 400) {
    return `The model "${model}" rejected the request. It may not accept images or structured output.`;
  }
  if (name === 'AI_NoObjectGeneratedError' || name === 'AI_NoOutputGeneratedError') {
    return 'The model answered, but not in the expected format. Please try again.';
  }
  if (type === 'timeout_error' || (err instanceof Error && /abort|timeout/i.test(`${err.name} ${err.message}`))) {
    return 'The model took too long to respond. Please try again.';
  }
  return `The model could not complete this request${status ? ` (gateway status ${status})` : ''}. Please try again.`;
}
