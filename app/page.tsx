"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export default function Home() {
  const router = useRouter();
  const [siteUrl, setSiteUrl] = useState("");
  const [maxPages, setMaxPages] = useState(8);
  const [maxQueries, setMaxQueries] = useState(3);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!siteUrl.trim()) return;
    const params = new URLSearchParams({
      url: siteUrl.trim(),
      maxPages: String(maxPages),
      maxQueries: String(maxQueries),
    });
    router.push(`/analyze?${params.toString()}`);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-semibold mb-2">StealMySERP</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Crawls your site (English &amp; Bangla), infers target queries, checks real
          Google results (top 10 + People Also Ask + related searches), finds content
          gaps, and surfaces public outreach contacts — built entirely on free tools.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="siteUrl" className="block text-sm font-medium mb-1">
              Website URL
            </label>
            <input
              id="siteUrl"
              type="url"
              required
              placeholder="https://example.com"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label htmlFor="maxQueries" className="block text-sm font-medium mb-1">
                Max target queries: {maxQueries}
              </label>
              <input
                id="maxQueries"
                type="range"
                min={1}
                max={5}
                value={maxQueries}
                onChange={(e) => setMaxQueries(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 text-sm transition-colors"
          >
            Start analysis
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
