import { AIResumeParse } from "@job-ai/ai/schemas/index";
import { jsonSchemaFor } from "@job-ai/ai/schemas/index";
import util from "util";

function toGeminiSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const clean = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(clean);
    if (!node || typeof node !== "object") return node;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "additionalProperties" || k === "$schema" || k === "default")
        continue;
      result[k] = clean(v);
    }
    return result;
  };
  return clean(schema) as Record<string, unknown>;
}

const schema = jsonSchemaFor(AIResumeParse);
console.log(util.inspect(toGeminiSchema(schema), { depth: null }));
