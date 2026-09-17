"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ExportButtons } from "@/components/ExportButtons";
import { ProgressStepper, type LogEntry } from "@/components/ProgressStepper";
import { ReportView } from "@/components/ReportView";
import { fetchSerpViaExtension } from "@/lib/orchestrator/extensionSerp";
import { postJson } from "@/lib/orchestrator/postJson";
import { chunk, delay, domainOf } from "@/lib/shared/chunk";
import type {
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

export function AnalyzeClient() {
  const searchParams = useSearchParams();
  const siteUrl = searchParams.get("url") ?? "";
  const maxPages = Number(searchParams.get("maxPages") ?? 8);
  const maxQueries = Number(searchParams.get("maxQueries") ?? 3);

  const [log, setLog] = useState<LogEntry[]>([]);
  const [report, setReport] = useState<RunReport | null>(null);
  const [status, setStatus] = useState<"running" | "done" | "fatal">("running");
  const [fatalMessage, setFatalMessage] = useState("");
  const started = useRef(false);

  function addLog(stage: string, message: string, status: LogEntry["status"]) {
    const id = crypto.randomUUID();
    setLog((prev) => [...prev, { id, stage, message, status }]);
  }

  useEffect(() => {
    if (started.current || !siteUrl) return;
    started.current = true;
    void run();

    async function run() {
      const runReport: RunReport = {
        siteUrl,
        createdAt: new Date().toISOString(),
        pages: [],
        pageQueries: [],
        serpResults: [],
        gapReports: [],
        contacts: [],
      };

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
          "success"
        );

        addLog("extract", "Reading page content...", "pending");
        const pages: PageContent[] = [];
        for (const group of chunk(discover.pages, EXTRACT_CHUNK_SIZE)) {
          const res = await postJson<{ extracted: PageContent[] }>(
            "/api/analyze/extract",
            { urls: group }
          );
          pages.push(...res.extracted);
        }
        const okPages = pages.filter((p) => !p.error);
        runReport.pages = pages;
        setReport({ ...runReport });
        addLog(
          "extract",
          `Extracted ${okPages.length}/${pages.length} pages successfully`,
          okPages.length > 0 ? "success" : "error"
        );

        if (okPages.length === 0) {
          throw new Error("Could not read any pages from this site.");
        }

        addLog("queries", "Inferring target queries with the LLM...", "pending");
        const pageQueries: PageQueries[] = [];
        for (const group of chunk(okPages, QUERIES_CHUNK_SIZE)) {
          const res = await postJson<{ pageQueries: PageQueries[] }>(
            "/api/analyze/queries",
            { pages: group }
          );
          pageQueries.push(...res.pageQueries);
          await delay(LLM_DELAY_MS);
        }
        runReport.pageQueries = pageQueries;
        setReport({ ...runReport });
        addLog(
          "queries",
          `Inferred queries for ${pageQueries.filter((q) => q.queries.length > 0).length}/${okPages.length} pages`,
          "success"
        );

        interface SelectedQuery {
          pageUrl: string;
          query: string;
          languageOfQuery: Lang;
        }
        const seen = new Set<string>();
        const selected: SelectedQuery[] = pageQueries
          .flatMap((pq) =>
            pq.queries.map((q) => ({
              pageUrl: pq.pageUrl,
              query: q.query,
              languageOfQuery: q.languageOfQuery,
              confidence: q.confidence,
            }))
          )
          .sort((a, b) => b.confidence - a.confidence)
          .filter((q) => {
            const key = q.query.toLowerCase().trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, maxQueries);

        if (selected.length === 0) {
          addLog("queries", "No target queries to analyze further.", "error");
          setReport({ ...runReport });
          setStatus("done");
          return;
        }

        const useExtensionBridge = process.env.NEXT_PUBLIC_SERP_SOURCE === "extension";
        addLog(
          "serp",
          useExtensionBridge
            ? "Fetching Google results via the browser extension bridge..."
            : "Fetching Google results (top 10 + PAA + related)...",
          "pending"
        );
        const serpResults: SerpResult[] = [];
        for (const sel of selected) {
          const serp = useExtensionBridge
            ? await fetchSerpViaExtension(sel.query, sel.languageOfQuery)
            : await postJson<SerpResult>("/api/analyze/serp", {
                query: sel.query,
                lang: sel.languageOfQuery,
              });
          serpResults.push(serp);
          addLog(
            "serp",
            serp.error || serp.blocked
              ? `"${sel.query}" — ${serp.error ?? "blocked"}`
              : `"${sel.query}" — ${serp.top10.length} results, ${serp.paa.length} PAA, ${serp.relatedSearches.length} related`,
            serp.error || serp.blocked ? "error" : "success"
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
          const res = await postJson<{ competitorPages: PageContent[] }>(
            "/api/analyze/competitors",
            { urls }
          );
          competitorsByQuery.set(serp.query, res.competitorPages);
          await delay(500);
        }
        addLog("competitors", "Competitor pages fetched.", "success");

        addLog("gaps", "Running content gap analysis...", "pending");
        const gapReports: GapReport[] = [];
        for (const sel of selected) {
          const serp = serpResults.find((s) => s.query === sel.query);
          const userPage = okPages.find((p) => p.url === sel.pageUrl);
          if (!serp || !userPage) continue;
          const res = await postJson<{ gapReport: GapReport }>("/api/analyze/gaps", {
            userPage,
            serp,
            competitors: competitorsByQuery.get(serp.query) ?? [],
          });
          gapReports.push(res.gapReport);
          addLog(
            "gaps",
            res.gapReport.error
              ? `"${sel.query}" — ${res.gapReport.error}`
              : `"${sel.query}" — analysis complete`,
            res.gapReport.error ? "error" : "success"
          );
          await delay(LLM_DELAY_MS);
        }
        runReport.gapReports = gapReports;
        setReport({ ...runReport });

        addLog("contacts", "Finding public contact info on competing sites...", "pending");
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
          const res = await postJson<{ contacts: ContactInfo[] }>(
            "/api/analyze/contacts",
            { domains: group }
          );
          contacts.push(...res.contacts);
        }
        runReport.contacts = contacts;
        setReport({ ...runReport });
        addLog(
          "contacts",
          `Found contact info for ${contacts.filter((c) => c.emails.length > 0 || c.socialLinks.length > 0).length}/${domains.length || 0} domains`,
          "success"
        );

        setStatus("done");
      } catch (err) {
        setFatalMessage(err instanceof Error ? err.message : "Analysis failed");
        setStatus("fatal");
      }
    }
  }, [siteUrl, maxPages, maxQueries]);

  if (!siteUrl) {
    return <p className="text-sm text-red-500">No URL provided.</p>;
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-xl font-semibold break-all">{siteUrl}</h1>
        <Link
          href="/"
          className="shrink-0 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          New analysis
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        {status === "running" && "Analysis in progress — this can take 1–3 minutes..."}
        {status === "done" && "Analysis complete."}
        {status === "fatal" && `Analysis stopped: ${fatalMessage}`}
      </p>

      <div className="mb-8">
        <ProgressStepper log={log} />
      </div>

      {report && status === "done" && (
        <>
          <div className="mb-6">
            <ExportButtons report={report} />
          </div>
          <ReportView report={report} />
        </>
      )}

      {report && status === "running" && <ReportView report={report} />}
    </div>
  );
}
