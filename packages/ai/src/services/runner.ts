import type { AIProvider, AIUsage } from "@job-ai/types";
import { AIError } from "@job-ai/types";
import type { z } from "zod";
import type { PromptTemplate } from "../prompts/shared.ts";
import { jsonSchemaFor } from "../schemas/index.ts";

export interface RunOptions {
  signal?: AbortSignal;

  maxAttempts?: number;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface RunResult<T> {
  data: T;
  usage: AIUsage;
  promptVersion: string;

  repaired: boolean;
}

export function repairJson(raw: string): string {
  let text = raw.trim();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) text = fenced[1].trim();

  const start = text.indexOf("{");
  if (start === -1) return text;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  let candidate = text.slice(start);
  if (inString) candidate += '"';
  candidate = candidate.replace(/,\s*$/, "");
  return candidate + "}".repeat(Math.max(0, depth));
}

export async function runPrompt<TInput, TSchema extends z.ZodType>(
  provider: AIProvider,
  prompt: PromptTemplate<TInput>,
  schema: TSchema,
  input: TInput,
  options: RunOptions = {},
): Promise<RunResult<z.infer<TSchema>>> {
  const maxAttempts = options.maxAttempts ?? 2;
  let lastError: AIError = new AIError(
    "unknown",
    "The request was not attempted.",
  );
  let repaired = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await provider.complete({
        task: prompt.task,
        system: prompt.system,
        user:
          attempt === 1
            ? prompt.build(input)
            : `${prompt.build(input)}\n\nIMPORTANT: your previous reply was not valid JSON matching the requested shape. Reply with the JSON object only.`,
        jsonSchema: jsonSchemaFor(schema),
        ...(options.temperature !== undefined
          ? { temperature: options.temperature }
          : {}),
        ...(options.maxOutputTokens !== undefined
          ? { maxOutputTokens: options.maxOutputTokens }
          : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      });

      const cleaned = repairJson(response.text);

      if (cleaned !== response.text.trim()) repaired = true;

      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        lastError = new AIError(
          "invalid-response",
          "The model did not return valid JSON.",
          true,
        );
        continue;
      }

      const result = schema.safeParse(parsed);
      if (!result.success) {
        const issue = result.error.issues[0];
        lastError = new AIError(
          "invalid-response",
          `The model's response did not match the expected shape${issue ? ` (${issue.path.join(".") || "root"}: ${issue.message})` : ""}.`,
          true,
        );
        continue;
      }

      return {
        data: result.data as z.infer<TSchema>,
        usage: response.usage,
        promptVersion: `${prompt.task}@${prompt.version}`,
        repaired,
      };
    } catch (err) {
      lastError =
        err instanceof AIError
          ? err
          : new AIError("unknown", "The AI request failed.");
      if (!lastError.retryable) throw lastError;

      if (attempt < maxAttempts) await sleep(600 * attempt);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
