"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Logo } from "@/components/Logo";
import { ProgressStepper, type LogEntry } from "@/components/ProgressStepper";
import { QuickCheckReport, type QueryWithSerp } from "@/components/QuickCheckReport";
import { fetchSerpViaExtension, pingExtensionBridge } from "@/lib/orchestrator/extensionSerp";
import { postJson } from "@/lib/orchestrator/postJson";
import { cleanAiOverviewText } from "@/lib/shared/aiOverviewText";
import { delay } from "@/lib/shared/chunk";
import type { PageContent, PageQueries, SerpResult } from "@/lib/shared/types";

const SERP_DELAY_MS = 2500;

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
        <QuickCheckReport page={page} pageQueries={pageQueries} rows={rows} status={status} />
      )}
    </div>
  );
}
