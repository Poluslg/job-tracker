import { AIResumeParse } from './packages/ai/src/schemas/index.ts';
import { zodToJsonSchema } from 'zod-to-json-schema';

const schema = zodToJsonSchema(AIResumeParse);
console.log(JSON.stringify(schema, null, 2));
