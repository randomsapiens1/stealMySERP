"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ExportButtons } from "@/components/ExportButtons";
import { Logo } from "@/components/Logo";
import { ProgressStepper, type LogEntry } from "@/components/ProgressStepper";
import { QuerySelector } from "@/components/QuerySelector";
import { ReportView } from "@/components/ReportView";
import { fetchSerpViaExtension, pingExtensionBridge } from "@/lib/orchestrator/extensionSerp";
import { postJson } from "@/lib/orchestrator/postJson";
import { cleanAiOverviewText } from "@/lib/shared/aiOverviewText";
import { chunk, delay, domainOf } from "@/lib/shared/chunk";
import { localeForLang } from "@/lib/shared/lang";
import type {
  AiOverviewSourceReport,
  ContactInfo,
  GapReport,
  Lang,
  PageContent,
  PageQueries,
  RunReport,
  SerpResult,
} from "@/lib/shared/types";

const EXTRACT_CHUNK_SIZE = 5;
const QUERIES_CHUNK_SIZE = 5;
const CONTACTS_CHUNK_SIZE = 5;
const SERP_DELAY_MS = 2500;
const LLM_DELAY_MS = 1500;
const MAX_CONTACT_DOMAINS = 15;

interface SelectedQuery {
  pageUrl: string;
  query: string;
  languageOfQuery: Lang;
}

export function AnalyzeClient() {
  const searchParams = useSearchParams();
  const siteUrl = searchParams.get("url") ?? "";
  const maxPages = Number(searchParams.get("maxPages") ?? 8);

  const [log, setLog] = useState<LogEntry[]>([]);
  const [report, setReport] = useState<RunReport | null>(null);
  const [status, setStatus] = useState<
    "running" | "selecting" | "analyzing" | "done" | "fatal"
  >("running");
  const [fatalMessage, setFatalMessage] = useState("");
  const [retryingGaps, setRetryingGaps] = useState<Set<string>>(new Set());
  const [retryingSerp, setRetryingSerp] = useState<Set<string>>(new Set());
  const [retryingSourceInsights, setRetryingSourceInsights] = useState<Set<string>>(new Set());
  const started = useRef(false);
  const runReportRef = useRef<RunReport | null>(null);
  const okPagesRef = useRef<PageContent[]>([]);
  const competitorsByQueryRef = useRef<Map<string, PageContent[]>>(new Map());
  const selectedRef = useRef<SelectedQuery[]>([]);
  const retryRef = useRef<() => void>(() => {});

  function addLog(stage: string, message: string, status: LogEntry["status"]) {
    const id = crypto.randomUUID();
    setLog((prev) => [...prev, { id, stage, message, status }]);
  }

  useEffect(() => {
    if (started.current || !siteUrl) return;
    started.current = true;

    async function discoverAndInferQueries() {
      setStatus("running");
      setFatalMessage("");

      const runReport: RunReport = {
        siteUrl,
        createdAt: new Date().toISOString(),
        pages: [],
        pageQueries: [],
        serpResults: [],
        gapReports: [],
        sourceInsights: [],
        contacts: [],
      };
      runReportRef.current = runReport;

      try {
        addLog("discover", "Finding pages to analyze...", "pending");
        const discover = await postJson<{
          pages: string[];
          mode: "single-page" | "sitemap" | "link-crawl";
        }>("/api/analyze/discover", { siteUrl, limit: maxPages });
        const modeLabel =
          discover.mode === "single-page"
            ? "analyzing this page only"
            : discover.mode === "sitemap"
              ? "via sitemap"
              : "via link crawl";
        addLog(
          "discover",
          `Found ${discover.pages.length} page${discover.pages.length === 1 ? "" : "s"} (${modeLabel})`,
          "success",
        );

        addLog("extract", "Reading page content...", "pending");
        const pages: PageContent[] = [];
        for (const group of chunk(discover.pages, EXTRACT_CHUNK_SIZE)) {
          const res = await postJson<{ extracted: PageContent[] }>(
            "/api/analyze/extract",
            { urls: group },
          );
          pages.push(...res.extracted);
        }
        const okPages = pages.filter((p) => !p.error);
        okPagesRef.current = okPages;
        runReport.pages = pages;
        setReport({ ...runReport });
        addLog(
          "extract",
          `Extracted ${okPages.length}/${pages.length} pages successfully`,
          okPages.length > 0 ? "success" : "error",
        );

        if (okPages.length === 0) {
          throw new Error("Could not read any pages from this site.");
        }

        addLog(
          "queries",
          "Inferring target queries with the LLM...",
          "pending",
        );
        const pageQueries: PageQueries[] = [];
        for (const group of chunk(okPages, QUERIES_CHUNK_SIZE)) {
          const res = await postJson<{ pageQueries: PageQueries[] }>(
            "/api/analyze/queries",
            { pages: group },
          );
          pageQueries.push(...res.pageQueries);
          await delay(LLM_DELAY_MS);
        }
        runReport.pageQueries = pageQueries;
        setReport({ ...runReport });

        const totalQueries = pageQueries.reduce(
          (n, pq) => n + pq.queries.length,
          0,
        );
        if (totalQueries === 0) {
          addLog(
            "queries",
            "No target queries could be inferred for any page.",
            "error",
          );
          setStatus("done");
          return;
        }

        addLog(
          "queries",
          `Inferred ${totalQueries} candidate queries across ${pageQueries.filter((q) => q.queries.length > 0).length}/${okPages.length} pages — choose which to analyze below.`,
          "success",
        );
        setStatus("selecting");
      } catch (err) {
        setFatalMessage(err instanceof Error ? err.message : "Analysis failed");
        setStatus("fatal");
      }
    }

    retryRef.current = () => void discoverAndInferQueries();
    void discoverAndInferQueries();
  }, [siteUrl, maxPages]);

  async function analyzeSelectedQueries(
    picked: { pageUrl: string; query: string }[],
  ) {
    const runReport = runReportRef.current;
    const okPages = okPagesRef.current;
    if (!runReport) return;

    retryRef.current = () => void analyzeSelectedQueries(picked);
    setStatus("analyzing");
    setFatalMessage("");

    try {
      const selected: SelectedQuery[] = picked
        .map(({ pageUrl, query }) => {
          const pq = runReport.pageQueries.find((p) => p.pageUrl === pageUrl);
          const match = pq?.queries.find((iq) => iq.query === query);
          return match
            ? { pageUrl, query, languageOfQuery: match.languageOfQuery }
            : null;
        })
        .filter((q): q is SelectedQuery => q !== null);
      selectedRef.current = selected;

      addLog(
        "queries",
        `Analyzing ${selected.length} selected ${selected.length === 1 ? "query" : "queries"}...`,
        "success",
      );

      const useExtensionBridge =
        process.env.NEXT_PUBLIC_SERP_SOURCE === "extension" &&
        (await pingExtensionBridge());
      addLog(
        "serp",
        useExtensionBridge
          ? "Fetching Google results via the browser extension bridge..."
          : "Fetching Google results (top 10 + PAA + related)...",
        "pending",
      );
      const serpResults: SerpResult[] = [];
      for (const sel of selected) {
        let serp: SerpResult;
        try {
          serp = useExtensionBridge
            ? await fetchSerpViaExtension(sel.query, sel.languageOfQuery)
            : await postJson<SerpResult>("/api/analyze/serp", {
                query: sel.query,
                lang: sel.languageOfQuery,
              });
        } catch (err) {
          const { hl, gl } = localeForLang(sel.languageOfQuery);
          serp = {
            query: sel.query,
            hl,
            gl,
            top10: [],
            paa: [],
            relatedSearches: [],
            aiOverview: null,
            error: err instanceof Error ? err.message : "SERP fetch failed",
          };
        }
        if (serp.aiOverview) {
          serp.aiOverview = {
            ...serp.aiOverview,
            text: cleanAiOverviewText(serp.aiOverview.text),
          };
        }
        serpResults.push(serp);
        addLog(
          "serp",
          serp.error || serp.blocked
            ? `"${sel.query}" — ${serp.error ?? "blocked"}`
            : `"${sel.query}" — ${serp.top10.length} results, ${serp.paa.length} PAA, ${serp.relatedSearches.length} related`,
          serp.error || serp.blocked ? "error" : "success",
        );
        await delay(SERP_DELAY_MS);
      }
      runReport.serpResults = serpResults;
      setReport({ ...runReport });

      addLog("competitors", "Fetching competitor pages...", "pending");
      const competitorsByQuery = new Map<string, PageContent[]>();
      for (const serp of serpResults) {
        const urls = serp.top10.slice(0, 5).map((r) => r.url);
        if (urls.length === 0) {
          competitorsByQuery.set(serp.query, []);
          continue;
        }
        try {
          const res = await postJson<{ competitorPages: PageContent[] }>(
            "/api/analyze/competitors",
            { urls },
          );
          competitorsByQuery.set(serp.query, res.competitorPages);
        } catch {
          competitorsByQuery.set(serp.query, []);
        }
        await delay(500);
      }
      competitorsByQueryRef.current = competitorsByQuery;
      addLog("competitors", "Competitor pages fetched.", "success");

      addLog("gaps", "Running content gap analysis...", "pending");
      const gapReports: GapReport[] = [];
      for (const sel of selected) {
        const serp = serpResults.find((s) => s.query === sel.query);
        const userPage = okPages.find((p) => p.url === sel.pageUrl);
        if (!serp || !userPage) continue;
        let gapReport: GapReport;
        try {
          const res = await postJson<{ gapReport: GapReport }>(
            "/api/analyze/gaps",
            {
              userPage,
              serp,
              competitors: competitorsByQuery.get(serp.query) ?? [],
            },
          );
          gapReport = res.gapReport;
        } catch (err) {
          gapReport = {
            query: sel.query,
            pageUrl: sel.pageUrl,
            coveredWell: [],
            contentGaps: [],
            missingPaaQuestions: [],
            structureSuggestions: [],
            recommendedNewSections: [],
            error: err instanceof Error ? err.message : "Gap analysis failed",
          };
        }
        gapReports.push(gapReport);
        addLog(
          "gaps",
          gapReport.error
            ? `"${sel.query}" — ${gapReport.error}`
            : `"${sel.query}" — analysis complete`,
          gapReport.error ? "error" : "success",
        );
        await delay(LLM_DELAY_MS);
      }
      runReport.gapReports = gapReports;
      setReport({ ...runReport });

      const queriesWithAioSources = serpResults.filter(
        (serp) => (serp.aiOverview?.sourceCards?.length ?? 0) > 0,
      );
      if (queriesWithAioSources.length > 0) {
        addLog(
          "aio-sources",
          "Checking why Google's AI Overview cited each source...",
          "pending",
        );
        const sourceInsights: AiOverviewSourceReport[] = [];
        for (const serp of queriesWithAioSources) {
          let sourceReport: AiOverviewSourceReport | null;
          try {
            const res = await postJson<{ sourceReport: AiOverviewSourceReport | null }>(
              "/api/analyze/source-insights",
              { serp },
            );
            sourceReport = res.sourceReport;
          } catch (err) {
            sourceReport = {
              query: serp.query,
              insights: [],
              error: err instanceof Error ? err.message : "AI Overview source analysis failed",
            };
          }
          if (sourceReport) sourceInsights.push(sourceReport);
          addLog(
            "aio-sources",
            sourceReport?.error
              ? `"${serp.query}" — ${sourceReport.error}`
              : `"${serp.query}" — analyzed ${sourceReport?.insights.length ?? 0} cited source(s)`,
            sourceReport?.error ? "error" : "success",
          );
          await delay(LLM_DELAY_MS);
        }
        runReport.sourceInsights = sourceInsights;
        setReport({ ...runReport });
      }

      addLog(
        "contacts",
        "Finding public contact info on competing sites...",
        "pending",
      );
      const ownDomain = domainOf(siteUrl);
      const domainSet = new Set<string>();
      for (const serp of serpResults) {
        for (const r of serp.top10) {
          const d = domainOf(r.url);
          if (d && d !== ownDomain) domainSet.add(d);
        }
      }
      const domains = Array.from(domainSet).slice(0, MAX_CONTACT_DOMAINS);
      const contacts: ContactInfo[] = [];
      for (const group of chunk(domains, CONTACTS_CHUNK_SIZE)) {
        try {
          const res = await postJson<{ contacts: ContactInfo[] }>(
            "/api/analyze/contacts",
            { domains: group },
          );
          contacts.push(...res.contacts);
        } catch {
          // Per-item resilience: a failed contacts chunk shouldn't lose the
          // SERP/gap data already gathered — just skip these domains.
        }
      }
      runReport.contacts = contacts;
      setReport({ ...runReport });
      addLog(
        "contacts",
        `Found contact info for ${contacts.filter((c) => c.emails.length > 0 || c.socialLinks.length > 0).length}/${domains.length || 0} domains`,
        "success",
      );

      try {
        await postJson("/api/history/save", runReport);
        addLog("history", "Saved to history dashboard.", "success");
      } catch (err) {
        addLog(
          "history",
          `Couldn't save to history: ${err instanceof Error ? err.message : "unknown error"}`,
          "error",
        );
      }

      setStatus("done");
    } catch (err) {
      setFatalMessage(err instanceof Error ? err.message : "Analysis failed");
      setStatus("fatal");
    }
  }

  async function retrySerp(query: string) {
    const runReport = runReportRef.current;
    const sel = selectedRef.current.find((s) => s.query === query);
    if (!runReport || !sel) return;

    setRetryingSerp((prev) => new Set(prev).add(query));

    const useExtensionBridge =
      process.env.NEXT_PUBLIC_SERP_SOURCE === "extension" && (await pingExtensionBridge());

    let serp: SerpResult;
    try {
      serp = useExtensionBridge
        ? await fetchSerpViaExtension(sel.query, sel.languageOfQuery)
        : await postJson<SerpResult>("/api/analyze/serp", {
            query: sel.query,
            lang: sel.languageOfQuery,
          });
    } catch (err) {
      const { hl, gl } = localeForLang(sel.languageOfQuery);
      serp = {
        query: sel.query,
        hl,
        gl,
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

    runReport.serpResults = runReport.serpResults.map((s) => (s.query === query ? serp : s));
    setReport({ ...runReport });
    setRetryingSerp((prev) => {
      const next = new Set(prev);
      next.delete(query);
      return next;
    });
  }

  async function retryGap(pageUrl: string, query: string) {
    const runReport = runReportRef.current;
    if (!runReport) return;

    const key = `${pageUrl}::${query}`;
    setRetryingGaps((prev) => new Set(prev).add(key));

    const serp = runReport.serpResults.find((s) => s.query === query);
    const userPage = okPagesRef.current.find((p) => p.url === pageUrl);

    let gapReport: GapReport;
    if (!serp || !userPage) {
      gapReport = {
        query,
        pageUrl,
        coveredWell: [],
        contentGaps: [],
        missingPaaQuestions: [],
        structureSuggestions: [],
        recommendedNewSections: [],
        error: "Missing SERP or page data for this query — re-run the full analysis.",
      };
    } else {
      try {
        const res = await postJson<{ gapReport: GapReport }>("/api/analyze/gaps", {
          userPage,
          serp,
          competitors: competitorsByQueryRef.current.get(query) ?? [],
        });
        gapReport = res.gapReport;
      } catch (err) {
        gapReport = {
          query,
          pageUrl,
          coveredWell: [],
          contentGaps: [],
          missingPaaQuestions: [],
          structureSuggestions: [],
          recommendedNewSections: [],
          error: err instanceof Error ? err.message : "Gap analysis failed",
        };
      }
    }

    runReport.gapReports = runReport.gapReports.map((g) =>
      g.pageUrl === pageUrl && g.query === query ? gapReport : g,
    );
    setReport({ ...runReport });
    setRetryingGaps((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  async function retrySourceInsights(query: string) {
    const runReport = runReportRef.current;
    if (!runReport) return;

    const serp = runReport.serpResults.find((s) => s.query === query);
    if (!serp) return;

    setRetryingSourceInsights((prev) => new Set(prev).add(query));

    let sourceReport: AiOverviewSourceReport | null;
    try {
      const res = await postJson<{ sourceReport: AiOverviewSourceReport | null }>(
        "/api/analyze/source-insights",
        { serp },
      );
      sourceReport = res.sourceReport;
    } catch (err) {
      sourceReport = {
        query,
        insights: [],
        error: err instanceof Error ? err.message : "AI Overview source analysis failed",
      };
    }

    if (sourceReport) {
      const exists = runReport.sourceInsights.some((r) => r.query === query);
      runReport.sourceInsights = exists
        ? runReport.sourceInsights.map((r) => (r.query === query ? sourceReport! : r))
        : [...runReport.sourceInsights, sourceReport];
      setReport({ ...runReport });
    }

    setRetryingSourceInsights((prev) => {
      const next = new Set(prev);
      next.delete(query);
      return next;
    });
  }

  if (!siteUrl) {
    return <p className="text-sm text-red-500">No URL provided.</p>;
  }

  return (
    <div>
      <div className="flex justify-center mb-6">
        <Logo className="h-14 w-auto" />
      </div>
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-xl font-semibold break-all">{siteUrl}</h1>
        <div className="flex gap-2 shrink-0">
          <Link
            href="/history"
            className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            Dashboard
          </Link>
          <Link
            href="/"
            className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            New analysis
          </Link>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        {status === "running" &&
          "Reading pages and inferring queries — this takes a moment..."}
        {status === "selecting" &&
          "Pick which queries to check against real Google results."}
        {status === "analyzing" &&
          "Analysis in progress — this can take 1–3 minutes..."}
        {status === "done" && "Analysis complete."}
        {status === "fatal" && `Analysis stopped: ${fatalMessage}`}
      </p>

      {status === "fatal" && (
        <button
          type="button"
          onClick={() => retryRef.current()}
          className="mb-6 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 text-sm transition-colors"
        >
          Retry
        </button>
      )}

      <div className="mb-8">
        <ProgressStepper log={log} />
      </div>

      {report && status === "selecting" && (
        <QuerySelector
          pageQueries={report.pageQueries}
          onSubmit={analyzeSelectedQueries}
        />
      )}

      {report && status !== "selecting" && (
        <>
          {status === "done" && (
            <div className="mb-6">
              <ExportButtons report={report} />
            </div>
          )}
          <ReportView
            report={report}
            onRetryGap={retryGap}
            retryingGaps={retryingGaps}
            onRetrySerp={retrySerp}
            retryingSerp={retryingSerp}
            onRetrySourceInsights={retrySourceInsights}
            retryingSourceInsights={retryingSourceInsights}
          />
        </>
      )}
    </div>
  );
}
