import OpenAI from 'openai';
import { apiEnv } from '../env.api.js';
import { HttpError } from '../lib/errors.js';

const client = new OpenAI({ apiKey: apiEnv.OPENAI_API_KEY });

export interface ImagePart {
  mimeType: string;
  base64: string;
}

/**
 * One structured-output call. OpenAI's strict json_schema mode requires every
 * property to be listed in `required` and `additionalProperties: false`, which
 * `strictSchema` below enforces — the schemas came from Base44's looser
 * `response_json_schema` and would be rejected as-is.
 */
export async function completeJson<T>(opts: {
  model: string;
  prompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  images?: ImagePart[];
  maxTokens?: number;
}): Promise<T> {
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: opts.prompt },
  ];

  for (const image of opts.images ?? []) {
    content.push({
      type: 'image_url',
      // Files live on a private volume, so the model gets the bytes inline
      // rather than a URL it has no credentials to fetch.
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
    });
  }

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 2048,
      messages: [{ role: 'user', content }],
      response_format: {
        type: 'json_schema',
        json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
      },
    });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 429) {
      throw new HttpError(503, 'The assistant is busy, try again in a moment', 'ai_busy');
    }
    throw new HttpError(502, 'The assistant is unavailable right now', 'ai_unavailable');
  }

  const choice = completion.choices[0];
  if (choice?.finish_reason === 'length') {
    throw new HttpError(502, 'The assistant ran out of room to answer', 'ai_truncated');
  }
  if (choice?.message.refusal) {
    throw new HttpError(422, 'The assistant could not answer that', 'ai_refused');
  }

  const raw = choice?.message.content;
  if (!raw) throw new HttpError(502, 'The assistant returned nothing', 'ai_empty');

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(502, 'The assistant returned malformed data', 'ai_malformed');
  }
}

/**
 * OpenAI strict mode rejects a schema unless every key is required and objects
 * forbid extra properties. Optional fields are expressed as nullable instead,
 * which is why callers get `string | null` for things like `old_name`.
 */
export function strictSchema(properties: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

export const nullable = (type: string) => ({ type: [type, 'null'] });
