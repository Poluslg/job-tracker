import { AIResumeParse } from './src/schemas/index.ts';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { toGeminiSchema } from './src/providers/gemini.ts';

const schema = zodToJsonSchema(AIResumeParse);

// The clean function from gemini.ts
function cleanSchema(schema: any): any {
  const clean = (node: any): any => {
    if (Array.isArray(node)) return node.map(clean);
    if (!node || typeof node !== 'object') return node;
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(node as Record<string, any>)) {
      if (k === 'additionalProperties' || k === '$schema' || k === 'default') continue;
      result[k] = clean(v);
    }
    return result;
  };
  return clean(schema);
}

console.log(JSON.stringify(cleanSchema(schema), null, 2));
