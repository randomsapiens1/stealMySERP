"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalyzedPageRecord, SavedQuery } from "@/lib/db/history";
import { historyToCsv } from "@/lib/export/historyToCsv";
import { fetchSerpViaExtension, pingExtensionBridge } from "@/lib/orchestrator/extensionSerp";
import { postJson } from "@/lib/orchestrator/postJson";
import { cleanAiOverviewText } from "@/lib/shared/aiOverviewText";
import { domainOf } from "@/lib/shared/chunk";
import { modeHref } from "@/lib/shared/modes";
import { findRank } from "@/lib/shared/serpInsights";
import type {
  AiOverviewSourceReport,
  ContactInfo,
  ContentGap,
  GapReport,
  PageContent,
  SerpResult,
} from "@/lib/shared/types";
import {
  fullDateLabel,
  groupBySite,
  latestRecordsByPage,
  pageKey,
  pagePathLabel,
  rankTierClasses,
  runHeaderLabel,
  siteLabel,
  type SiteStats,
} from "@/lib/history/metrics";
import { DashboardStatCard } from "./DashboardStatCard";
import {
  ArrowRightIcon,
  ExternalLinkIcon,
  FileIcon,
  GapIcon,
  GlobeIcon,
  RefreshIcon,
  SearchIcon,
  SparkleIcon,
  TrendingUpIcon,
  ZapIcon,
} from "./icons";

const EXTENSION_CONFIGURED = process.env.NEXT_PUBLIC_SERP_SOURCE === "extension";
const COMPETITOR_LIMIT = 5;

function download(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "keywords", label: "Keywords" },
  { id: "gaps", label: "Content Gaps" },
  { id: "aiOverview", label: "AI Overview" },
  { id: "pages", label: "Pages" },
  { id: "contacts", label: "Contacts" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function QueryRankBadge({ query }: { query: SavedQuery }) {
  if (query.serpBlocked || query.serpError) {
    return (
      <span
        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400 dark:bg-gray-800 dark:text-gray-500"
        title="Google search was blocked or errored for this query"
      >
        n/a
      </span>
    );
  }
  if (query.verifiedRank === null) {
    return <span className="text-xs text-gray-400 dark:text-gray-600">Not ranking</span>;
  }
  return (
    <span
      className={`inline-flex min-w-[2.25rem] justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${rankTierClasses(query.verifiedRank)}`}
    >
      #{query.verifiedRank}
    </span>
  );
}

function QueryRow({
  query,
  gap,
  onRetry,
  retrying,
}: {
  query: SavedQuery;
  gap: GapReport | undefined;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="py-3 border-b border-gray-100 dark:border-gray-900 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          <span>{query.query}</span>
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 tabular-nums">
            {Math.round(query.confidence * 100)}% conf.
          </span>
        </div>
        <QueryRankBadge query={query} />
      </div>

      {gap?.error && (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="text-xs text-red-500">{gap.error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              title="Retry this query's gap analysis"
              aria-label={`Retry gap analysis for "${query.query}"`}
              className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50"
            >
              <RefreshIcon className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      )}
      {gap && !gap.error && gap.contentGaps.length > 0 && (
        <ul className="mt-1.5 ml-4 list-disc space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
          {gap.contentGaps.map((g, i) => (
            <li key={i}>
              <span className="font-medium text-gray-700 dark:text-gray-300">{g.topic}</span> — {g.whyItMatters}
            </li>
          ))}
        </ul>
      )}
      {gap && !gap.error && gap.contentGaps.length === 0 && (
        <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">No content gaps found</p>
      )}
    </div>
  );
}

function AllQueriesRow({
  pageUrl,
  query,
  onCheck,
  checking,
}: {
  pageUrl: string;
  query: SavedQuery;
  onCheck: () => void;
  checking: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-gray-100 dark:border-gray-900 last:border-0">
      <div className="min-w-0 text-sm">
        <div className="truncate flex items-center gap-1.5">
          {query.query}
          {query.aiOverview && (
            <SparkleIcon
              className="h-3 w-3 text-purple-400 dark:text-purple-500 shrink-0"
            />
          )}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {pagePathLabel(pageKey(pageUrl))} · {Math.round(query.confidence * 100)}% conf.
        </div>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <QueryRankBadge query={query} />
        <button
          type="button"
          onClick={onCheck}
          disabled={checking}
          title="Run a fresh Google search for this keyword"
          aria-label={`Run Google search for "${query.query}"`}
          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50"
        >
          <SearchIcon className={`h-3.5 w-3.5 ${checking ? "animate-pulse" : ""}`} />
        </button>
      </div>
    </div>
  );
}

function AiOverviewCard({
  pageUrl,
  query,
  sourceReport,
  onRecheck,
  rechecking,
}: {
  pageUrl: string;
  query: SavedQuery;
  sourceReport: AiOverviewSourceReport | undefined;
  onRecheck: () => void;
  rechecking: boolean;
}) {
  const aiOverview = query.aiOverview;
  if (!aiOverview) return null;
  const sourceCards = aiOverview.sourceCards ?? [];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{query.query}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{pagePathLabel(pageKey(pageUrl))}</div>
        </div>
        <button
          type="button"
          onClick={onRecheck}
          disabled={rechecking}
          title="Re-check this keyword"
          aria-label={`Re-check AI Overview for "${query.query}"`}
          className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50"
        >
          <RefreshIcon className={`h-3.5 w-3.5 ${rechecking ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="px-4 py-3">
        <div className="mb-3 rounded-md border border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/30 p-3">
          <div className="text-xs font-medium text-purple-700 dark:text-purple-400 mb-1 flex items-center gap-1.5">
            <SparkleIcon className="h-3.5 w-3.5" />
            Google AI Overview
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">{aiOverview.text}</p>
        </div>

        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
          Who Google is recommending
        </div>
        {sourceReport?.error ? (
          <p className="text-sm text-red-500">{sourceReport.error}</p>
        ) : sourceReport && sourceReport.insights.length > 0 ? (
          <ul className="divide-y divide-gray-100 dark:divide-gray-900">
            {sourceReport.insights.map((insight) => (
              <li key={insight.url} className="py-2">
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={insight.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium hover:underline break-all"
                  >
                    {insight.title || insight.url}
                  </a>
                  {insight.topicDrift && (
                    <span className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      Fanned out
                    </span>
                  )}
                </div>
                {insight.whySuggested && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{insight.whySuggested}</p>
                )}
                {insight.topicDrift && insight.driftReason && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{insight.driftReason}</p>
                )}
              </li>
            ))}
          </ul>
        ) : sourceCards.length > 0 ? (
          <ul className="divide-y divide-gray-100 dark:divide-gray-900">
            {sourceCards.map((card) => (
              <li key={card.url} className="py-2 text-sm">
                <a href={card.url} target="_blank" rel="noreferrer" className="font-medium hover:underline break-all">
                  {card.title || card.url}
                </a>
              </li>
            ))}
          </ul>
        ) : aiOverview.sources.length > 0 ? (
          <p className="text-xs text-gray-500 break-all">
            {aiOverview.sources.map((url, i) => (
              <span key={url}>
                {i > 0 && ", "}
                <a href={url} target="_blank" rel="noreferrer" className="hover:underline">
                  {url}
                </a>
              </span>
            ))}
          </p>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-600">No cited sources captured.</p>
        )}
      </div>
    </div>
  );
}

function ContactCard({ contact }: { contact: ContactInfo }) {
  const confidenceClasses =
    contact.confidence === "high"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
  const hasDetails = contact.emails.length > 0 || contact.contactPageUrl || contact.socialLinks.length > 0;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <a
          href={`https://${contact.domain}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-medium truncate hover:underline"
        >
          {contact.domain}
          <ExternalLinkIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        </a>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${confidenceClasses}`}>
          {contact.confidence} confidence
        </span>
      </div>

      <div className="px-4 py-3 text-sm space-y-2.5">
        {contact.emails.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Emails</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {contact.emails.map((email) => (
                <a key={email} href={`mailto:${email}`} className="hover:underline break-all">
                  {email}
                </a>
              ))}
            </div>
          </div>
        )}
        {contact.contactPageUrl && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Contact page</div>
            <a
              href={contact.contactPageUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:underline break-all"
            >
              {contact.contactPageUrl}
            </a>
          </div>
        )}
        {contact.socialLinks.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Social</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {contact.socialLinks.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="hover:underline">
                  {domainOf(url) ?? url}
                </a>
              ))}
            </div>
          </div>
        )}
        {!hasDetails && (
          <p className="text-xs text-gray-400 dark:text-gray-600">No contact details found.</p>
        )}
      </div>
    </div>
  );
}

function PageBlock({
  record,
  onDelete,
  onCheckKeyword,
  checkingKeywords,
}: {
  record: AnalyzedPageRecord;
  onDelete: (id: number) => void;
  onCheckKeyword: (recordId: number, pageUrl: string, query: SavedQuery) => void;
  checkingKeywords: Set<string>;
}) {
  const header = runHeaderLabel(record.analyzedAt);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <a
          href={record.pageUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-medium truncate hover:underline"
        >
          {pagePathLabel(pageKey(record.pageUrl))}
          <ExternalLinkIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        </a>
        <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500 dark:text-gray-400">
          <span>
            analyzed {header.date}, {header.time}
          </span>
          <button onClick={() => onDelete(record.id)} className="text-red-500 hover:underline">
            Delete
          </button>
        </div>
      </div>

      <div className="px-4">
        {record.queries.length === 0 ? (
          <p className="py-3 text-xs text-gray-400 dark:text-gray-600">No queries inferred for this page.</p>
        ) : (
          record.queries.map((q) => (
            <QueryRow
              key={q.query}
              query={q}
              gap={record.gapReports.find((g) => g.query === q.query)}
              onRetry={() => onCheckKeyword(record.id, record.pageUrl, q)}
              retrying={checkingKeywords.has(`${record.id}::${q.query}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* -------------------------------- Overview panels -------------------------------- */

function TopKeywordsCard({ pages, onViewAll }: { pages: AnalyzedPageRecord[]; onViewAll: () => void }) {
  const top = useMemo(() => {
    return pages
      .flatMap((r) => r.queries.map((q) => ({ query: q, pageUrl: r.pageUrl })))
      .filter((row) => row.query.verifiedRank !== null)
      .sort((a, b) => (a.query.verifiedRank as number) - (b.query.verifiedRank as number))
      .slice(0, 5);
  }, [pages]);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <SearchIcon className="h-4 w-4 text-gray-400" />
          Top Keywords
        </h3>
        <button onClick={onViewAll} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          View all →
        </button>
      </div>
      {top.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No ranked keywords yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                <th className="pb-2 pr-3">Keyword</th>
                <th className="pb-2 px-3">Page</th>
                <th className="pb-2 pl-3 text-right">Position</th>
              </tr>
            </thead>
            <tbody>
              {top.map(({ query, pageUrl }) => (
                <tr key={`${pageUrl}::${query.query}`} className="border-t border-gray-100 dark:border-gray-900">
                  <td className="py-2 pr-3 truncate max-w-[220px]">{query.query}</td>
                  <td className="py-2 px-3 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[140px]">
                    {pagePathLabel(pageKey(pageUrl))}
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <span
                      className={`inline-flex min-w-[2.25rem] justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${rankTierClasses(query.verifiedRank as number)}`}
                    >
                      #{query.verifiedRank}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ContentGapsCard({
  gapTopics,
  onViewAll,
}: {
  gapTopics: { topic: string; whyItMatters: string; seenIn: string[] }[];
  onViewAll: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <GapIcon className="h-4 w-4 text-gray-400" />
          Content Gaps
        </h3>
        <button onClick={onViewAll} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          View all →
        </button>
      </div>
      {gapTopics.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No content gaps found yet.</p>
      ) : (
        <ol className="space-y-2.5">
          {gapTopics.slice(0, 5).map((g, i) => (
            <li key={`${g.topic}-${i}`} className="flex items-start gap-2.5">
              <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}.</span>
              <div className="min-w-0">
                <p className="text-sm truncate">{g.topic}</p>
                {g.seenIn.length > 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-600">seen on {g.seenIn.length} competitor page{g.seenIn.length === 1 ? "" : "s"}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TopCompetitorsCard({ domains }: { domains: [string, number][] }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
        <GlobeIcon className="h-4 w-4 text-gray-400" />
        Top Competitors
      </h3>
      {domains.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No competitor domains surfaced by content-gap analysis yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                <th className="pb-2 pr-3">Domain</th>
                <th className="pb-2 pl-3 text-right">Gap topics seen on</th>
              </tr>
            </thead>
            <tbody>
              {domains.map(([domain, count]) => (
                <tr key={domain} className="border-t border-gray-100 dark:border-gray-900">
                  <td className="py-2 pr-3 truncate">{domain}</td>
                  <td className="py-2 pl-3 text-right tabular-nums">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QuickInsights({ stats }: { stats: SiteStats }) {
  const items: { icon: React.ReactNode; tone: string; text: React.ReactNode }[] = [];
  if (stats.top3Count > 0) {
    items.push({
      icon: <TrendingUpIcon className="h-4 w-4" />,
      tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
      text: (
        <>
          <strong>{stats.top3Count}</strong> keyword{stats.top3Count === 1 ? "" : "s"} ranking in the top 3.
        </>
      ),
    });
  }
  if (stats.strikingDistanceCount > 0) {
    items.push({
      icon: <SparkleIcon className="h-4 w-4" />,
      tone: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400",
      text: (
        <>
          <strong>{stats.strikingDistanceCount}</strong> keyword{stats.strikingDistanceCount === 1 ? "" : "s"} rank
          #11–#20 — close to page one.
        </>
      ),
    });
  }
  if (stats.gapCount > 0) {
    items.push({
      icon: <GapIcon className="h-4 w-4" />,
      tone: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
      text: (
        <>
          <strong>{stats.gapCount}</strong> content gap{stats.gapCount === 1 ? "" : "s"} found across{" "}
          {stats.pageCount} page{stats.pageCount === 1 ? "" : "s"}.
        </>
      ),
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
      <h3 className="text-sm font-semibold mb-3">Quick Insights</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Nothing to report yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.tone}`}>
                {item.icon}
              </span>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">{item.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActionsCard({
  site,
  records,
  onViewKeywords,
  onViewGaps,
}: {
  site: string;
  records: AnalyzedPageRecord[];
  onViewKeywords: () => void;
  onViewGaps: () => void;
}) {
  const actions = [
    {
      label: "Re-run analysis",
      icon: <RefreshIcon className="h-4 w-4" />,
      href: modeHref("full", `https://${site}`, 8),
    },
    {
      label: "View all keywords",
      icon: <SearchIcon className="h-4 w-4" />,
      onClick: onViewKeywords,
    },
    {
      label: "View content gaps",
      icon: <GapIcon className="h-4 w-4" />,
      onClick: onViewGaps,
    },
    {
      label: "Generate report",
      icon: <FileIcon className="h-4 w-4" />,
      onClick: () => download(`stealmyserp-${site}.csv`, historyToCsv(records), "text/csv"),
      disabled: records.length === 0,
    },
  ];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
        <ZapIcon className="h-4 w-4 text-gray-400" />
        Actions
      </h3>
      <div className="space-y-1">
        {actions.map((action) =>
          action.href ? (
            <a
              key={action.label}
              href={action.href}
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
                {action.icon}
              </span>
              <span className="flex-1 text-left">{action.label}</span>
              <ArrowRightIcon className="h-3.5 w-3.5 text-gray-300 dark:text-gray-700" />
            </a>
          ) : (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
                {action.icon}
              </span>
              <span className="flex-1 text-left">{action.label}</span>
              <ArrowRightIcon className="h-3.5 w-3.5 text-gray-300 dark:text-gray-700" />
            </button>
          )
        )}
      </div>
    </div>
  );
}

/* -------------------------------- Main view -------------------------------- */

export function SiteHistoryView({ site }: { site: string }) {
  const [records, setRecords] = useState<AnalyzedPageRecord[] | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<Tab>("overview");
  const [checkingKeywords, setCheckingKeywords] = useState<Set<string>>(new Set());
  const [keywordFilter, setKeywordFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError("");
      try {
        const res = await fetch(`/api/history/list?search=${encodeURIComponent(site)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Failed to load history");
        // The search endpoint matches substrings across site/page/topic, so
        // narrow to an exact hostname match before rendering.
        const filtered = (data.pages as AnalyzedPageRecord[]).filter(
          (r) => siteLabel(r.siteUrl) === site
        );
        if (!cancelled) setRecords(filtered);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load history");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [site, reloadKey]);

  const pages = useMemo(() => latestRecordsByPage(records ?? []), [records]);
  const stats = useMemo(() => groupBySite(records ?? [])[0], [records]);
  const queryCount = useMemo(() => pages.reduce((n, r) => n + r.queries.length, 0), [pages]);
  const contacts = useMemo(() => {
    const byDomain = new Map<string, ContactInfo>();
    for (const record of pages) {
      for (const contact of record.contacts) {
        if (!byDomain.has(contact.domain)) byDomain.set(contact.domain, contact);
      }
    }
    return Array.from(byDomain.values());
  }, [pages]);

  const gapTopics = useMemo(() => {
    const out: { topic: string; whyItMatters: string; seenIn: string[] }[] = [];
    for (const record of pages) {
      for (const gap of record.gapReports) {
        for (const topic of gap.contentGaps as ContentGap[]) {
          out.push(topic);
        }
      }
    }
    return out;
  }, [pages]);

  const topCompetitorDomains = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of gapTopics) {
      for (const domain of g.seenIn) {
        if (domain === "Google AI Overview") continue;
        counts.set(domain, (counts.get(domain) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [gapTopics]);

  const filteredKeywordRows = useMemo(() => {
    const rows = pages.flatMap((r) => r.queries.map((q) => ({ pageUrl: r.pageUrl, query: q })));
    if (!keywordFilter.trim()) return rows;
    const needle = keywordFilter.trim().toLowerCase();
    return rows.filter(({ query }) => query.query.toLowerCase().includes(needle));
  }, [pages, keywordFilter]);

  const aiOverviewRows = useMemo(() => {
    const withOverview: { record: AnalyzedPageRecord; query: SavedQuery }[] = [];
    const withoutOverview: { record: AnalyzedPageRecord; query: SavedQuery }[] = [];
    for (const record of pages) {
      for (const q of record.queries) {
        (q.aiOverview ? withOverview : withoutOverview).push({ record, query: q });
      }
    }
    return { withOverview, withoutOverview };
  }, [pages]);

  const category = useMemo(() => {
    if (!records || records.length === 0) return null;
    const latest = records.reduce((a, b) => (a.analyzedAt > b.analyzedAt ? a : b));
    return latest.primaryTopic || null;
  }, [records]);

  const monitoredSince = useMemo(() => {
    if (!records || records.length === 0) return null;
    const earliest = records.reduce((a, b) => (a.analyzedAt < b.analyzedAt ? a : b));
    return fullDateLabel(earliest.analyzedAt);
  }, [records]);

  async function handleDelete(id: number) {
    await fetch(`/api/history/${id}`, { method: "DELETE" });
    setRecords((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
  }

  // Runs a single keyword end-to-end — fresh Google search (via the
  // extension bridge when configured, since that's the only source that
  // reliably captures the AI Overview), a re-crawl of just this page, its
  // top competitors, gap analysis, and AI-Overview source analysis — then
  // saves the result onto this one query. Re-checking one keyword instead
  // of the whole site keeps this cheap enough to do on demand.
  async function checkKeyword(recordId: number, pageUrl: string, query: SavedQuery) {
    const key = `${recordId}::${query.query}`;
    setCheckingKeywords((prev) => new Set(prev).add(key));

    try {
      const useExtensionBridge = EXTENSION_CONFIGURED && (await pingExtensionBridge());

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
          hl: "en",
          gl: "us",
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

      const { extracted } = await postJson<{ extracted: PageContent[] }>("/api/analyze/extract", {
        urls: [pageUrl],
      });
      const userPage = extracted[0];

      let competitors: PageContent[] = [];
      if (!serp.blocked && !serp.error && serp.top10.length > 0) {
        const urls = serp.top10.slice(0, COMPETITOR_LIMIT).map((r) => r.url);
        const res = await postJson<{ competitorPages: PageContent[] }>("/api/analyze/competitors", { urls });
        competitors = res.competitorPages;
      }

      const { gapReport } = await postJson<{ gapReport: GapReport }>("/api/analyze/gaps", {
        userPage,
        serp,
        competitors,
      });

      let sourceReport: AiOverviewSourceReport | null = null;
      if ((serp.aiOverview?.sourceCards?.length ?? 0) > 0) {
        const res = await postJson<{ sourceReport: AiOverviewSourceReport | null }>(
          "/api/analyze/source-insights",
          { serp }
        );
        sourceReport = res.sourceReport;
      }

      const updatedQuery: SavedQuery = {
        ...query,
        verifiedRank: !serp.blocked && !serp.error ? findRank(pageUrl, serp.top10) : query.verifiedRank,
        serpBlocked: !!serp.blocked,
        serpError: serp.error ?? null,
        aiOverview: serp.aiOverview ?? null,
      };

      await postJson("/api/history/save-query-result", {
        id: recordId,
        query: query.query,
        updatedQuery,
        gapReport,
        sourceReport,
      });

      setRecords((prev) =>
        prev
          ? prev.map((r) =>
              r.id === recordId
                ? {
                    ...r,
                    queries: r.queries.map((q) => (q.query === query.query ? updatedQuery : q)),
                    gapReports: r.gapReports.some((g) => g.query === query.query)
                      ? r.gapReports.map((g) => (g.query === query.query ? gapReport : g))
                      : [...r.gapReports, gapReport],
                    sourceReports: sourceReport
                      ? r.sourceReports.some((sr) => sr.query === query.query)
                        ? r.sourceReports.map((sr) => (sr.query === query.query ? sourceReport! : sr))
                        : [...r.sourceReports, sourceReport]
                      : r.sourceReports.filter((sr) => sr.query !== query.query),
                  }
                : r
            )
          : prev
      );
    } catch {
      // Leave the previous state as-is — the spinner clearing is the
      // signal that the attempt finished.
    } finally {
      setCheckingKeywords((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  if (error)
    return (
      <div className="flex items-center gap-2 text-sm text-red-500">
        <span>{error}</span>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          title="Retry"
          aria-label="Retry loading site history"
          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <RefreshIcon className="h-4 w-4" />
        </button>
      </div>
    );
  if (records === null) return <p className="text-sm text-gray-500">Loading...</p>;
  if (records.length === 0 || !stats) {
    return <p className="text-sm text-gray-500">No history found for {site}.</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold uppercase">
          {site.charAt(0)}
        </div>
        <div>
          <a
            href={`https://${site}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xl font-semibold hover:underline"
          >
            {site}
            <ExternalLinkIcon className="h-4 w-4 text-gray-400" />
          </a>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {category && <>{category} · </>}
            {stats.pageCount} page{stats.pageCount === 1 ? "" : "s"} · {stats.auditCount} audit
            {stats.auditCount === 1 ? "" : "s"}
            {monitoredSince && <> · Monitored since {monitoredSince}</>}
          </p>
        </div>
      </div>

      <div className="flex gap-5 border-b border-gray-200 dark:border-gray-800 mb-6 mt-5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 -mb-px border-b-2 px-1 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <DashboardStatCard
              icon={<SearchIcon />}
              tint="emerald"
              label="Total Keywords Tracked"
              value={queryCount}
              sublabel={`${stats.rankedCount} ranked`}
            />
            <DashboardStatCard
              icon={<TrendingUpIcon />}
              tint="blue"
              label="Avg. Ranking Position"
              value={stats.avgRank ?? "—"}
              sublabel={stats.bestRank === null ? undefined : `best #${stats.bestRank}`}
            />
            <DashboardStatCard
              icon={<SparkleIcon />}
              tint="purple"
              label="Top 3 Keywords"
              value={stats.top3Count}
              sublabel="ranked in Google's top 3"
            />
            <DashboardStatCard
              icon={<GapIcon />}
              tint="indigo"
              label="Content Gaps"
              value={stats.gapCount}
              sublabel={`across ${stats.pageCount} page${stats.pageCount === 1 ? "" : "s"}`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <TopKeywordsCard pages={pages} onViewAll={() => setTab("keywords")} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ContentGapsCard gapTopics={gapTopics} onViewAll={() => setTab("gaps")} />
                <TopCompetitorsCard domains={topCompetitorDomains} />
              </div>
            </div>
            <div className="space-y-4">
              <QuickInsights stats={stats} />
              <ActionsCard
                site={site}
                records={records}
                onViewKeywords={() => setTab("keywords")}
                onViewGaps={() => setTab("gaps")}
              />
            </div>
          </div>
        </div>
      )}

      {tab === "keywords" && (
        <div>
          <div className="relative mb-3 max-w-sm">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search keywords..."
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4">
            {queryCount === 0 ? (
              <p className="py-3 text-sm text-gray-500">No queries tracked yet.</p>
            ) : filteredKeywordRows.length === 0 ? (
              <p className="py-3 text-sm text-gray-500">No keywords match &quot;{keywordFilter}&quot;.</p>
            ) : (
              filteredKeywordRows.map(({ pageUrl, query }) => {
                const record = pages.find((r) => r.pageUrl === pageUrl)!;
                return (
                  <AllQueriesRow
                    key={`${pageUrl}::${query.query}`}
                    pageUrl={pageUrl}
                    query={query}
                    onCheck={() => void checkKeyword(record.id, pageUrl, query)}
                    checking={checkingKeywords.has(`${record.id}::${query.query}`)}
                  />
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === "gaps" && (
        <div className="space-y-4">
          {pages.map((record) =>
            record.gapReports.map((gap) => {
              const gapQuery = record.queries.find((q) => q.query === gap.query);
              return (
                <div
                  key={`${record.pageUrl}::${gap.query}`}
                  className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <span className="font-medium text-sm">{gap.query}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {pagePathLabel(pageKey(record.pageUrl))}
                    </span>
                  </div>
                  <div className="px-4 py-3">
                    {gap.error && (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-red-500">{gap.error}</p>
                        {gapQuery && (
                          <button
                            type="button"
                            onClick={() => void checkKeyword(record.id, record.pageUrl, gapQuery)}
                            disabled={checkingKeywords.has(`${record.id}::${gap.query}`)}
                            title="Retry this query's gap analysis"
                            aria-label={`Retry gap analysis for "${gap.query}"`}
                            className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50"
                          >
                            <RefreshIcon
                              className={`h-3.5 w-3.5 ${checkingKeywords.has(`${record.id}::${gap.query}`) ? "animate-spin" : ""}`}
                            />
                          </button>
                        )}
                      </div>
                    )}
                    {!gap.error && gap.contentGaps.length === 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">No content gaps found</p>
                    )}
                    {!gap.error && gap.contentGaps.length > 0 && (
                      <ul className="space-y-2">
                        {gap.contentGaps.map((g, i) => (
                          <li key={i} className="text-sm">
                            <span className="font-medium">{g.topic}</span>
                            <span className="text-gray-500 dark:text-gray-400"> — {g.whyItMatters}</span>
                            {g.seenIn.length > 0 && (
                              <div className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                                seen on: {g.seenIn.join(", ")}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {pages.every((r) => r.gapReports.length === 0) && (
            <p className="text-sm text-gray-500">No content gap analysis recorded yet.</p>
          )}
        </div>
      )}

      {tab === "aiOverview" && (
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            {EXTENSION_CONFIGURED
              ? "Checking a keyword here uses the browser extension bridge, which is what reliably captures Google's AI Overview."
              : "AI Overview capture is most reliable via the browser extension bridge — see “Extension bridge” in the sidebar."}
          </p>

          {aiOverviewRows.withOverview.length > 0 && (
            <div className="space-y-4 mb-6">
              {aiOverviewRows.withOverview.map(({ record, query }) => (
                <AiOverviewCard
                  key={`${record.pageUrl}::${query.query}`}
                  pageUrl={record.pageUrl}
                  query={query}
                  sourceReport={record.sourceReports.find((r) => r.query === query.query)}
                  onRecheck={() => void checkKeyword(record.id, record.pageUrl, query)}
                  rechecking={checkingKeywords.has(`${record.id}::${query.query}`)}
                />
              ))}
            </div>
          )}

          {aiOverviewRows.withoutOverview.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Not checked for an AI Overview yet
              </p>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4">
                {aiOverviewRows.withoutOverview.map(({ record, query }) => (
                  <AllQueriesRow
                    key={`${record.pageUrl}::${query.query}`}
                    pageUrl={record.pageUrl}
                    query={query}
                    onCheck={() => void checkKeyword(record.id, record.pageUrl, query)}
                    checking={checkingKeywords.has(`${record.id}::${query.query}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {aiOverviewRows.withOverview.length === 0 && aiOverviewRows.withoutOverview.length === 0 && (
            <p className="text-sm text-gray-500">No queries tracked yet.</p>
          )}
        </div>
      )}

      {tab === "pages" && (
        <div className="space-y-4">
          {pages.map((record) => (
            <PageBlock
              key={pageKey(record.pageUrl)}
              record={record}
              onDelete={(id) => void handleDelete(id)}
              onCheckKeyword={(recordId, pageUrl, query) => void checkKeyword(recordId, pageUrl, query)}
              checkingKeywords={checkingKeywords}
            />
          ))}
        </div>
      )}

      {tab === "contacts" && (
        <div>
          {contacts.length === 0 ? (
            <p className="text-sm text-gray-500">No outreach contacts found yet.</p>
          ) : (
            <div className="space-y-4">
              {contacts.map((contact) => (
                <ContactCard key={contact.domain} contact={contact} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
