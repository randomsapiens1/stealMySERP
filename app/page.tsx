"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Logo } from "@/components/Logo";
import { MODES, type Mode, modeHref } from "@/lib/shared/modes";

export default function Home() {
  const router = useRouter();
  const [siteUrl, setSiteUrl] = useState("");
  const [mode, setMode] = useState<Mode>("full");
  const [maxPages, setMaxPages] = useState(8);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!siteUrl.trim()) return;
    router.push(modeHref(mode, siteUrl, maxPages));
  }

  const selectedMode = MODES.find((m) => m.id === mode)!;

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl">
        <div className="flex justify-end gap-2 mb-4">
          <Link
            href="/extension"
            className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            Get the extension
          </Link>
          <Link
            href="/history"
            className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            Dashboard
          </Link>
        </div>

        <div className="flex justify-center mb-8">
          <Logo className="h-24 sm:h-28 w-auto" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            id="siteUrl"
            type="url"
            required
            placeholder="https://example.com"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                aria-pressed={mode === m.id}
                className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  mode === m.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-500"
                    : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className={mode === m.id ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}
                  >
                    {m.icon}
                  </span>
                  <span className="text-sm font-medium">{m.label}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{m.description}</p>
              </button>
            ))}
          </div>

          {mode === "full" && (
            <div>
              <label htmlFor="maxPages" className="block text-sm font-medium mb-1">
                Max pages to crawl: {maxPages}
              </label>
              <input
                id="maxPages"
                type="range"
                min={1}
                max={15}
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                className="w-full"
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 text-sm transition-colors"
          >
            {selectedMode.buttonLabel}
          </button>
        </form>

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-6">
          Runs are deliberately paced to stay within free LLM/search rate limits, so a
          full analysis can take 1–3 minutes. Google search scraping is unofficial and
          can occasionally get blocked — the report will show per-item errors rather
          than failing the whole run.
        </p>
      </div>
    </main>
  );
}
