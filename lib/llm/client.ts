import OpenAI from "openai";
import PQueue from "p-queue";

// OpenRouter's free-model catalog churns — DeepSeek's free slugs were
// discontinued after this app was first built (still gone as of this
// writing; only paid DeepSeek slugs exist on OpenRouter now). Tried in
// order until one succeeds. Verified working + free as of this writing;
// check openrouter.ai/models (filter for ":free") if these start 404ing.
const MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nex-agi/nex-n2.5-pro:free",
  "google/gemma-4-31b-it:free",
  "z-ai/glm-5.2:free",
];
// Without a bound, a single hung request can occupy the queue's only
// concurrency slot forever, since PQueue won't advance to the next job
// until the current one settles — silently freezing every future LLM
// call in this process (found by exactly this happening after an
// abandoned run left a call hanging).
const REQUEST_TIMEOUT_MS = 60_000;

let openrouter: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openrouter) {
    openrouter = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }
  return openrouter;
}

// Only throttles calls within a single serverless invocation (Vercel
// functions don't share memory across requests) — the client orchestrator
// adds extra delay between stage calls as a second layer of pacing.
const queue = new PQueue({ concurrency: 1, intervalCap: 1, interval: 3500 });

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJson<T>(raw: string): T {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("LLM response was not valid JSON");
  }
}

async function callModel(
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const completion = await getClient().chat.completions.create(
    {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    },
    { timeout: REQUEST_TIMEOUT_MS }
  );
  return completion.choices[0]?.message?.content ?? "";
}

export async function completeJson<T>(
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Get a free key at openrouter.ai/keys."
    );
  }

  return queue.add(async () => {
    let lastError: unknown;

    for (const model of MODELS) {
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const raw = await callModel(model, systemPrompt, userPrompt);
          return extractJson<T>(raw);
        } catch (err) {
          lastError = err;
          const status = (err as { status?: number })?.status;
          if (status === 429 && attempt < 2) {
            await sleep(2000 * (attempt + 1) * 2);
            continue;
          }
          break; // non-429 error, or out of retries: try next model
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("LLM request failed");
  }) as Promise<T>;
}
