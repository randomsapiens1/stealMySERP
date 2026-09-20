"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Logo } from "@/components/Logo";
import { ProgressStepper, type LogEntry } from "@/components/ProgressStepper";
import { fetchSerpViaExtension, pingExtensionBridge } from "@/lib/orchestrator/extensionSerp";
import { postJson } from "@/lib/orchestrator/postJson";
import { cleanAiOverviewText } from "@/lib/shared/aiOverviewText";
import { delay } from "@/lib/shared/chunk";
import type { InferredQuery, PageContent, PageQueries, SerpResult } from "@/lib/shared/types";

const SERP_DELAY_MS = 2500;

interface QueryWithSerp {
  query: InferredQuery;
  serp: SerpResult | null;
}

function langBadgeClasses(lang: string): string {
  return lang === "bn"
    ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
    : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
}

function aggregatePaa(rows: QueryWithSerp[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const row of rows) {
    for (const q of row.serp?.paa ?? []) {
      const key = q.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        unique.push(q.trim());
      }
    }
  }
  return unique;
}

export function QuickCheckClient() {
  const [urlInput, setUrlInput] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "fatal">("idle");
  const [fatalMessage, setFatalMessage] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [page, setPage] = useState<PageContent | null>(null);
  const [pageQueries, setPageQueries] = useState<PageQueries | null>(null);
  const [rows, setRows] = useState<QueryWithSerp[]>([]);

  function addLog(stage: string, message: string, logStatus: LogEntry["status"]) {
    const id = crypto.randomUUID();
    setLog((prev) => [...prev, { id, stage, message, status: logStatus }]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url || status === "running") return;

    setStatus("running");
    setFatalMessage("");
    setLog([]);
    setPage(null);
    setPageQueries(null);
    setRows([]);

    try {
      addLog("extract", "Reading the page...", "pending");
      const extractRes = await postJson<{ extracted: PageContent[] }>(
        "/api/analyze/extract",
        { urls: [url] },
      );
      const extractedPage = extractRes.extracted[0];
      if (!extractedPage || extractedPage.error) {
        throw new Error(extractedPage?.error ?? "Could not read this page.");
      }
      setPage(extractedPage);
      addLog("extract", "Page read successfully.", "success");

      addLog(
        "queries",
        "Inferring up to 10 target queries (English + Bangla if relevant)...",
        "pending",
      );
      const queriesRes = await postJson<{ pageQueries: PageQueries }>(
        "/api/analyze/quick-queries",
        { page: extractedPage },
      );
      const inferred = queriesRes.pageQueries;
      setPageQueries(inferred);

      if (inferred.queries.length === 0) {
        addLog("queries", "No target queries could be inferred for this page.", "error");
        setStatus("done");
        return;
      }
      const bnCount = inferred.queries.filter((q) => q.languageOfQuery === "bn").length;
      const enCount = inferred.queries.length - bnCount;
      addLog(
        "queries",
        `Inferred ${inferred.queries.length} queries (${enCount} English${bnCount > 0 ? `, ${bnCount} Bangla` : ""}).`,
        "success",
      );

      const useExtensionBridge =
        process.env.NEXT_PUBLIC_SERP_SOURCE === "extension" && (await pingExtensionBridge());
      addLog(
        "serp",
        useExtensionBridge
          ? "Fetching Google results and People Also Ask via the browser extension bridge..."
          : "Fetching Google results and People Also Ask for each query...",
        "pending",
      );

      const nextRows: QueryWithSerp[] = [];
      for (const query of inferred.queries) {
        let serp: SerpResult;
        try {
          serp = useExtensionBridge
            ? await fetchSerpViaExtension(query.query, query.languageOfQuery)
            : await postJson<SerpResult>("/api/analyze/serp", {
                query: query.query,
                lang: query.languageOfQuery,
              });
        } catch (err) {
          serp = {
            query: query.query,
            hl: query.languageOfQuery === "bn" ? "bn" : "en",
            gl: query.languageOfQuery === "bn" ? "bd" : "us",
            top10: [],
            paa: [],
            relatedSearches: [],
            aiOverview: null,
            error: err instanceof Error ? err.message : "SERP fetch failed",
          };
        }
        if (serp.aiOverview) {
          serp.aiOverview = { ...serp.aiOverview, text: cleanAiOverviewText(serp.aiOverview.text) };
        }
        nextRows.push({ query, serp });
        setRows([...nextRows]);
        addLog(
          "serp",
          serp.error || serp.blocked
            ? `"${query.query}" — ${serp.error ?? "blocked"}`
            : `"${query.query}" — ${serp.top10.length} results, ${serp.paa.length} PAA`,
          serp.error || serp.blocked ? "error" : "success",
        );
        await delay(SERP_DELAY_MS);
      }

      setStatus("done");
    } catch (err) {
      setFatalMessage(err instanceof Error ? err.message : "Quick check failed");
      setStatus("fatal");
    }
  }

  const paaList = aggregatePaa(rows);

  return (
    <div>
      <div className="flex justify-center mb-6">
        <Logo className="h-14 w-auto" />
      </div>

      <div className="flex items-center justify-between gap-4 mb-1">
        <h1 className="text-xl font-semibold">Quick check</h1>
        <Link
          href="/"
          className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          Home
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Paste a link. We&apos;ll infer up to 10 likely search queries for it (English +
        Bangla when the site looks Bangladesh-relevant) and pull real Google results and
        People Also Ask questions for each — no competitor crawl or gap analysis.
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
        <input
          type="url"
          required
          placeholder="https://example.com/some-page"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          disabled={status === "running"}
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status === "running" || !urlInput.trim()}
          className="rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === "running" ? "Checking..." : "Check"}
        </button>
      </form>

      {status === "fatal" && (
        <p className="text-sm text-red-500 mb-6">Stopped: {fatalMessage}</p>
      )}

      <div className="mb-8">
        <ProgressStepper log={log} />
      </div>

      {pageQueries && pageQueries.queries.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold">{pageQueries.primaryTopic || page?.url}</h2>
            {pageQueries.bangladeshRelevant && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs whitespace-nowrap bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                Bangladesh-relevant
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-4 break-all">{page?.url}</p>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-800">
                  <th className="py-1.5 pr-4">Query</th>
                  <th className="py-1.5 pr-4">Lang</th>
                  <th className="py-1.5 pr-4">Intent</th>
                  <th className="py-1.5 pr-4">Results</th>
                  <th className="py-1.5 pr-4">PAA</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.query.query} className="border-b border-gray-100 dark:border-gray-900">
                    <td className="py-1.5 pr-4">{row.query.query}</td>
                    <td className="py-1.5 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${langBadgeClasses(row.query.languageOfQuery)}`}
                      >
                        {row.query.languageOfQuery === "bn" ? "BN" : "EN"}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4 text-gray-500">{row.query.intent}</td>
                    <td className="py-1.5 pr-4 text-gray-500">
                      {row.serp ? (row.serp.error ? "—" : row.serp.top10.length) : "…"}
                    </td>
                    <td className="py-1.5 pr-4 text-gray-500">
                      {row.serp ? (row.serp.error ? "—" : row.serp.paa.length) : "…"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {status === "done" && (
            <>
              <h3 className="text-base font-semibold mb-2">
                People Also Ask ({paaList.length})
              </h3>
              {paaList.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No People Also Ask questions were found for these queries.
                </p>
              ) : (
                <ul className="space-y-1.5 text-sm list-disc list-inside">
                  {paaList.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
