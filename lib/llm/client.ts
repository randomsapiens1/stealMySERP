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
const REQUEST_TIMEOUT_MS = 25_000;
// The routes that call completeJson set their own generous maxDuration
// (90-180s) to stay under Vercel's function timeout. Even so, cap the
// whole retry chain to a budget comfortably inside the tightest of those
// (gaps: 90s) — a platform kill mid-request returns a non-JSON error page
// that crashes the caller's JSON.parse instead of the graceful per-item
// error this is meant to be. Worst case wall time is TOTAL_BUDGET_MS + one
// REQUEST_TIMEOUT_MS (a call already in flight when the budget expires
// still runs to its own timeout).
const TOTAL_BUDGET_MS = 50_000;

// Supports multiple OpenRouter accounts (each with its own free-tier daily
// quota) as OPENROUTER_API_KEYS="key1,key2,...". Falls back to the single
// OPENROUTER_API_KEY for backwards compatibility. Keys are used strictly
// one at a time, in order — the next key is only touched once the current
// one reports its free-models-per-day quota is exhausted, never round-robin
// or in parallel. This is deliberate: interleaving requests across several
// accounts looks like coordinated quota evasion, whereas fully draining one
// account before moving to the next reads as one user who happens to have
// switched keys.
const API_KEYS = (process.env.OPENROUTER_API_KEYS ?? process.env.OPENROUTER_API_KEY ?? "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

// Module-level (not per-request) so once a key is marked exhausted, every
// subsequent call in this process reuses that decision instead of
// re-discovering it — but this only holds within one warm serverless
// instance; a different instance (cold start, or a concurrent instance
// under load) starts back at index 0. Acceptable here since Fluid Compute
// reuses instances aggressively and this app's usage is low-volume.
let activeKeyIndex = 0;
let openrouter: OpenAI | null = null;
let openrouterKeyForClient: string | null = null;

function getClient(): OpenAI {
  const key = API_KEYS[activeKeyIndex];
  if (!openrouter || openrouterKeyForClient !== key) {
    openrouter = new OpenAI({ apiKey: key, baseURL: "https://openrouter.ai/api/v1" });
    openrouterKeyForClient = key;
  }
  return openrouter;
}

function isDailyQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("free-models-per-day");
}

// Returns true if there was a next key to switch to.
function advanceKey(): boolean {
  if (activeKeyIndex >= API_KEYS.length - 1) return false;
  activeKeyIndex += 1;
  return true;
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
  if (API_KEYS.length === 0) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Get a free key at openrouter.ai/keys."
    );
  }

  return queue.add(async () => {
    let lastError: unknown;

    keyLoop: while (true) {
      const deadline = Date.now() + TOTAL_BUDGET_MS;

      modelLoop: for (const model of MODELS) {
        for (let attempt = 0; attempt <= 1; attempt++) {
          if (Date.now() >= deadline) break modelLoop;
          try {
            const raw = await callModel(model, systemPrompt, userPrompt);
            return extractJson<T>(raw);
          } catch (err) {
            lastError = err;
            if (isDailyQuotaError(err)) {
              // This key is done for the day — lock it out and, if another
              // account is configured, retry this same request from the top
              // on the next one rather than surfacing a failure.
              if (advanceKey()) continue keyLoop;
              break keyLoop;
            }
            const status = (err as { status?: number })?.status;
            if (status === 429 && attempt < 1 && Date.now() < deadline) {
              await sleep(1500);
              continue;
            }
            break; // non-429 error, or out of retries: try next model
          }
        }
      }
      break; // exhausted all models on this key without a daily-quota signal
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("LLM request failed");
  }) as Promise<T>;
}
