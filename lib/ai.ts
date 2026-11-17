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

/** A message that is safe to show a user; details stay in the server log. */
export function modelErrorMessage(err: unknown): string {
  console.error('[PillID] model call failed:', err);
  if (err instanceof Error && /abort|timeout/i.test(`${err.name} ${err.message}`)) {
    return 'The model took too long to respond. Please try again.';
  }
  return 'The model could not complete this request. Please try again.';
}
