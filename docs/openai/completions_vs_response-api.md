// ──────────────────────────────────────────────────────────────────────────────
// TypeScript-only GPT‑5 Responses Starter (Node + Express + SSE)
// Files are delimited with `// FILE: <path>` headers. Copy into a repo as-is.
// Requires: Node 18+ (or Bun/Deno with slight tweaks)
// ──────────────────────────────────────────────────────────────────────────────

// FILE: package.json
{
  "name": "gpt5-responses-ts-starter",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "node --enable-source-maps dist/server.js",
    "build": "tsc -p tsconfig.json",
    "lint": "eslint ."
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "openai": "^4.58.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.12.12",
    "eslint": "^9.4.0",
    "tsx": "^4.7.0",
    "typescript": "^5.5.4"
  }
}

// FILE: tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src"]
}

// FILE: .env.example
// Copy to .env and set your key
OPENAI_API_KEY=sk-REPLACE_ME
# Optional: pick a default model
OPENAI_MODEL=gpt-5

// FILE: src/env.ts
import 'dotenv/config';

export const ENV = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? 'gpt-5',
  PORT: Number(process.env.PORT ?? 3000),
};

if (!ENV.OPENAI_API_KEY) {
  console.warn('[WARN] OPENAI_API_KEY not set. Set it in .env');
}

// FILE: src/openai.ts
import OpenAI from 'openai';
import { ENV } from './env.js';

export const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
export const DEFAULT_MODEL = ENV.OPENAI_MODEL;

// FILE: src/types.ts
export type ToolCall = {
  name: string;
  arguments: unknown;
  call_id: string;
};

export type Weather = { city: string; tempC: number; condition: string };

// FILE: src/tools/weather.ts
// Example function tool the model can call.
import { z } from 'zod';
import type { Weather } from '../types.js';

export const weatherParams = z.object({ city: z.string().min(1) });

export async function getWeather(city: string): Promise<Weather> {
  // Dummy implementation. Replace with a real API call.
  await new Promise((r) => setTimeout(r, 150));
  return { city, tempC: 31, condition: 'hot-and-humid' };
}

export const weatherTool = {
  type: 'function',
  name: 'get_weather',
  description: 'Get current weather for a city',
  parameters: {
    type: 'object',
    properties: { city: { type: 'string' } },
    required: ['city'],
    additionalProperties: false,
  },
} as const;

// FILE: src/routes/respond.ts
import type { Request, Response } from 'express';
import { openai, DEFAULT_MODEL } from '../openai.js';
import { weatherParams, getWeather } from '../tools/weather.js';

// Non-streaming JSON endpoint — good for server-to-server calls
export async function respond(req: Request, res: Response) {
  try {
    const { prompt, previous_response_id, model } = req.body ?? {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt (string) is required' });
    }

    const r = await openai.responses.create({
      model: model ?? DEFAULT_MODEL,
      input: prompt,
      previous_response_id,
      // Example: built-in or custom tools
      tools: [
        // Built-in tools can be enabled like this:
        // { type: 'web_search' },
        // Your custom function tool:
        { type: 'function', ...({ ...({}) } as any), name: 'get_weather', description: 'Get current weather for a city', parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'], additionalProperties: false } },
      ],
      tool_choice: 'auto',
    });

    // If the model decided to call a function, handle it and send a follow-up
    const toolCalls = (r.output ?? []).filter((x: any) => x.type === 'function_call');

    if (toolCalls.length > 0) {
      const toolOutputs = [] as Array<{ type: 'function_call_output'; call_id: string; output: string }>;
      for (const call of toolCalls) {
        const parsed = JSON.parse(call.arguments ?? '{}');
        if (call.name === 'get_weather') {
          const { city } = weatherParams.parse(parsed);
          const data = await getWeather(city);
          toolOutputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(data) });
        }
      }

      const r2 = await openai.responses.create({
        model: model ?? DEFAULT_MODEL,
        previous_response_id: r.id,
        tool_outputs: toolOutputs,
      });

      return res.json({ id: r2.id, text: r2.output_text, raw: r2 });
    }

    return res.json({ id: r.id, text: r.output_text, raw: r });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err?.message ?? 'internal_error' });
  }
}

// FILE: src/routes/stream.ts
import type { Request, Response } from 'express';
import { openai, DEFAULT_MODEL } from '../openai.js';

// SSE streaming endpoint — bridge OpenAI stream to the browser
export async function stream(req: Request, res: Response) {
  try {
    const prompt = (req.query.q as string) ?? 'Say hello from GPT‑5';
    const model = (req.query.model as string) ?? DEFAULT_MODEL;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const stream = await openai.responses.stream({ model, input: prompt });

    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        res.write(`data: ${event.delta}\n\n`);
      }
      if (event.type === 'response.completed') {
        res.write('data: [DONE]\n\n');
        res.end();
      }
      if (event.type === 'response.error') {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify(event.error)}\n\n`);
      }
    }
  } catch (err: any) {
    res.write('event: error\n');
    res.write(`data: ${JSON.stringify({ message: err?.message ?? 'stream_error' })}\n\n`);
    res.end();
  }
}

// FILE: src/routes/json.ts
import type { Request, Response } from 'express';
import { openai, DEFAULT_MODEL } from '../openai.js';

// Guaranteed-JSON endpoint using a JSON schema
export async function jsonOut(req: Request, res: Response) {
  try {
    const productSchema = {
      type: 'json_schema',
      json_schema: {
        name: 'Products',
        schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  price: { type: 'number' },
                  in_stock: { type: 'boolean' },
                },
                required: ['name', 'price', 'in_stock'],
                additionalProperties: false,
              },
            },
          },
          required: ['items'],
          additionalProperties: false,
        },
        strict: true,
      },
    } as const;

    const r = await openai.responses.create({
      model: (req.query.model as string) ?? DEFAULT_MODEL,
      input: 'Return three pretend products as JSON.',
      response_format: productSchema,
    });

    return res.json(JSON.parse(r.output_text));
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'json_error' });
  }
}

// FILE: src/server.ts
import express from 'express';
import { ENV } from './env.js';
import { respond } from './routes/respond.js';
import { stream } from './routes/stream.js';
import { jsonOut } from './routes/json.js';

const app = express();
app.use(express.json());

app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.post('/api/respond', respond);
app.get('/api/stream', stream); // SSE: /api/stream?q=Hello
app.get('/api/products.json', jsonOut);

app.listen(ENV.PORT, () => {
  console.log(`Server listening on http://localhost:${ENV.PORT}`);
});

// FILE: src/cli.ts
// Quick CLI to test streaming in your terminal
import { openai, DEFAULT_MODEL } from './openai.js';

async function main() {
  const q = process.argv.slice(2).join(' ') || 'Write a one-line joke about Pad Thai';
  const stream = await openai.responses.stream({ model: DEFAULT_MODEL, input: q });
  for await (const ev of stream) {
    if (ev.type === 'response.output_text.delta') process.stdout.write(ev.delta);
    if (ev.type === 'response.completed') process.stdout.write('\n');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// FILE: README.md
# GPT‑5 Responses — TypeScript starter

A tiny Node + Express + SSE starter that uses the **Responses API** with **GPT‑5**.

## Run
```bash
pnpm i # or npm i / yarn
cp .env.example .env && $EDITOR .env
pnpm dev
```

## Endpoints
- `POST /api/respond` — non‑stream JSON; will handle function tool calls (`get_weather`) automatically
- `GET /api/stream?q=hello` — SSE streaming (for browsers)
- `GET /api/products.json` — guaranteed JSON via `response_format`

## Notes
- Replace the dummy weather tool with a real API.
- For multi‑turn chat, pass `previous_response_id` back to `/api/respond`.
- To enable built‑in tools like **web_search** or **file_search**, add them to `tools` in `respond.ts`.
