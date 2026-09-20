"use client";

import { useMemo, useState } from "react";
import {
  ChevronDownIcon,
  ExternalLinkIcon,
  FileIcon,
  GlobeIcon,
  HelpCircleIcon,
  RefreshIcon,
  SearchIcon,
} from "@/components/history/icons";
import { StatCard } from "@/components/history/StatCard";
import type { InferredQuery, PageContent, PageQueries, SerpResult } from "@/lib/shared/types";

export interface QueryWithSerp {
  query: InferredQuery;
  serp: SerpResult | null;
}

interface PaaEntry {
  question: string;
  queries: string[];
}

function langBadgeClasses(lang: string): string {
  return lang === "bn"
    ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
    : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
}

function aggregatePaa(rows: QueryWithSerp[]): PaaEntry[] {
  const byKey = new Map<string, PaaEntry>();
  for (const row of rows) {
    for (const q of row.serp?.paa ?? []) {
      const trimmed = q.trim();
      const key = trimmed.toLowerCase();
      if (!key) continue;
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.queries.includes(row.query.query)) existing.queries.push(row.query.query);
      } else {
        byKey.set(key, { question: trimmed, queries: [row.query.query] });
      }
    }
  }
  return Array.from(byKey.values());
}

function queryDomId(query: string): string {
  return `qc-query-${encodeURIComponent(query)}`;
}

function QueryDetail({ serp }: { serp: SerpResult }) {
  if (serp.error || serp.blocked) {
    return (
      <p className="text-sm text-red-500">{serp.error ?? "Google blocked this request."}</p>
    );
  }

  return (
    <div className="space-y-5">
      {serp.top10.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Top {serp.top10.length} results
          </h4>
          <ol className="space-y-2.5">
            {serp.top10.map((r) => (
              <li key={r.position} className="flex gap-2.5 text-sm">
                <span className="text-gray-400 dark:text-gray-600 tabular-nums shrink-0 w-4 text-right">
                  {r.position}
                </span>
                <div className="min-w-0">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium hover:underline break-words"
                  >
                    {r.title || r.url}
                    <ExternalLinkIcon className="h-3 w-3 text-gray-400 shrink-0" />
                  </a>
                  <div className="text-xs text-gray-500 dark:text-gray-400 break-all">{r.url}</div>
                  {r.snippet && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{r.snippet}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {serp.paa.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            People Also Ask
          </h4>
          <ul className="space-y-1 text-sm list-disc list-inside">
            {serp.paa.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {serp.relatedSearches.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Related searches
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {serp.relatedSearches.map((r) => (
              <span
                key={r}
                className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {serp.aiOverview && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400 mb-1.5">
            AI Overview
          </h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {serp.aiOverview.text}
          </p>
          {serp.aiOverview.sources.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Cited: {serp.aiOverview.sources.join(", ")}
            </p>
          )}
        </div>
      )}

      {serp.top10.length === 0 && serp.paa.length === 0 && serp.relatedSearches.length === 0 && !serp.aiOverview && (
        <p className="text-sm text-gray-500">No results found for this query.</p>
      )}
    </div>
  );
}

function QueryCard({
  row,
  expanded,
  onToggle,
  onRetry,
  retrying,
}: {
  row: QueryWithSerp;
  expanded: boolean;
  onToggle: () => void;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { query, serp } = row;
  const hasError = !!(serp?.error || serp?.blocked);

  return (
    <div
      id={queryDomId(query.query)}
      className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden scroll-mt-4"
    >
      <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/60">
        <button type="button" onClick={onToggle} className="flex-1 flex items-center gap-3 min-w-0 text-left">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs shrink-0 ${langBadgeClasses(query.languageOfQuery)}`}
          >
            {query.languageOfQuery === "bn" ? "BN" : "EN"}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{query.query}</span>
          <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400 shrink-0">
            {query.intent}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 tabular-nums">
            {serp === null ? "…" : hasError ? "blocked" : `${serp.top10.length} results · ${serp.paa.length} PAA`}
          </span>
        </button>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            title="Retry this query's Google search"
            aria-label={`Retry Google search for "${query.query}"`}
            className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40 disabled:cursor-wait"
          >
            <RefreshIcon className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
          </button>
        )}
        <button type="button" onClick={onToggle} aria-label="Toggle details">
          <ChevronDownIcon
            className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {expanded && serp && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-900">
          <QueryDetail serp={serp} />
        </div>
      )}
    </div>
  );
}

export function QuickCheckReport({
  page,
  pageQueries,
  rows,
  status,
  onRetryQuery,
  retryingQueries,
}: {
  page: PageContent | null;
  pageQueries: PageQueries;
  rows: QueryWithSerp[];
  status: "idle" | "running" | "done" | "fatal";
  onRetryQuery?: (query: string) => void;
  retryingQueries?: Set<string>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(query: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(query)) next.delete(query);
      else next.add(query);
      return next;
    });
  }

  function jumpToQuery(query: string) {
    setExpanded((prev) => new Set(prev).add(query));
    document.getElementById(queryDomId(query))?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const paaList = useMemo(() => aggregatePaa(rows), [rows]);
  const totalResults = useMemo(
    () => rows.reduce((n, r) => n + (r.serp?.top10.length ?? 0), 0),
    [rows],
  );
  const bnCount = pageQueries.queries.filter((q) => q.languageOfQuery === "bn").length;
  const enCount = pageQueries.queries.length - bnCount;

  return (
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard icon={<SearchIcon />} label="Queries checked" value={pageQueries.queries.length} />
        <StatCard icon={<GlobeIcon />} label="EN / BN split" value={`${enCount} / ${bnCount}`} />
        <StatCard icon={<FileIcon />} label="Results found" value={totalResults} />
        <StatCard icon={<HelpCircleIcon />} label="Unique PAA" value={paaList.length} />
      </div>

      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
        Queries — click one to see its results
      </h3>
      <div className="space-y-2 mb-8">
        {rows.map((row) => (
          <QueryCard
            key={row.query.query}
            row={row}
            expanded={expanded.has(row.query.query)}
            onToggle={() => toggle(row.query.query)}
            onRetry={onRetryQuery ? () => onRetryQuery(row.query.query) : undefined}
            retrying={retryingQueries?.has(row.query.query) ?? false}
          />
        ))}
      </div>

      {status === "done" && (
        <>
          <h3 className="text-base font-semibold mb-2">
            All People Also Ask questions ({paaList.length})
          </h3>
          {paaList.length === 0 ? (
            <p className="text-sm text-gray-500">
              No People Also Ask questions were found for these queries.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {paaList.map((entry) => (
                <li key={entry.question} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span>{entry.question}</span>
                  <span className="flex flex-wrap gap-1">
                    {entry.queries.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => jumpToQuery(q)}
                        className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                        title={`Jump to "${q}"`}
                      >
                        {q}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
