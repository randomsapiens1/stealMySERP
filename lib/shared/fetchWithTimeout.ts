const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export interface FetchWithTimeoutOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export async function fetchWithTimeout(
  url: string,
  { timeoutMs = 9000, headers = {} }: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        ...headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTextWithTimeout(
  url: string,
  options?: FetchWithTimeoutOptions
): Promise<string> {
  const res = await fetchWithTimeout(url, options);
  if (!res.ok) {
    throw new Error(`Request to ${url} failed with status ${res.status}`);
  }
  return res.text();
}
