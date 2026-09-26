"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AnalyzedPageRecord } from "@/lib/db/history";
import { historyToCsv } from "@/lib/export/historyToCsv";
import {
  computeOverview,
  gapSeverity,
  groupBySite,
  latestRecordsByPage,
  rankTierClasses,
  relativeTimeFromNow,
  type SiteStats,
} from "@/lib/history/metrics";
import { QUICKSTART_FOCUS_EVENT } from "./QuickStartBar";
import { DashboardStatCard } from "./DashboardStatCard";
import {
  ArrowRightIcon,
  FileIcon,
  GapIcon,
  GlobeIcon,
  MailIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  SparkleIcon,
  TrendingUpIcon,
  ZapIcon,
} from "./icons";
import { RankSparkline } from "./Sparkline";

function download(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function focusQuickStart(mode: "full" | "quick" | "content") {
  window.dispatchEvent(new CustomEvent(QUICKSTART_FOCUS_EVENT, { detail: { mode } }));
}

function GapPill({ count }: { count: number }) {
  const severity = gapSeverity(count);
  if (!severity) {
    return <span className="text-xs text-gray-400 dark:text-gray-600">—</span>;
  }
  const toneClasses = {
    low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    high: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  }[severity.tone];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className="font-medium tabular-nums">{count}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${toneClasses}`}>
        {severity.label}
      </span>
    </span>
  );
}

function SiteRow({ group }: { group: SiteStats }) {
  return (
    <tr className="border-t border-gray-100 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900/60">
      <td className="py-3 pl-4 pr-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-sm font-semibold uppercase">
            {group.site.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{group.site}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {group.auditCount} audit{group.auditCount === 1 ? "" : "s"} · last{" "}
              {relativeTimeFromNow(group.lastAnalyzedAt)}
            </div>
          </div>
        </div>
      </td>
      <td className="py-3 px-3 tabular-nums">{group.keywordCount}</td>
      <td className="py-3 px-3 tabular-nums">{group.avgRank === null ? "—" : group.avgRank}</td>
      <td className="py-3 px-3">
        <RankSparkline values={group.rankHistory} />
      </td>
      <td className="py-3 px-3">
        <GapPill count={group.gapCount} />
      </td>
      <td className="py-3 px-3">
        <span className="inline-flex items-center gap-1.5 text-sm tabular-nums">
          <MailIcon className="h-3.5 w-3.5 text-gray-400" />
          {group.contactCount}
        </span>
      </td>
      <td className="py-3 px-3">
        <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          Active
        </span>
      </td>
      <td className="py-3 pl-3 pr-4 text-right">
        <Link
          href={`/history/${encodeURIComponent(group.site)}`}
          aria-label={`View ${group.site} details`}
          title="View details"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:hover:text-gray-100 dark:hover:bg-gray-900"
        >
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}

/* -------------------------------- Insights & keywords -------------------------------- */

function RecentInsights({
  groups,
  totalGaps,
  latestRecord,
}: {
  groups: SiteStats[];
  totalGaps: number;
  latestRecord: AnalyzedPageRecord | undefined;
}) {
  const overview = useMemo(() => computeOverview(groups), [groups]);
  const timeLabel = latestRecord ? relativeTimeFromNow(latestRecord.analyzedAt) : "";

  const items: { icon: React.ReactNode; tone: string; text: React.ReactNode }[] = [];
  if (totalGaps > 0) {
    items.push({
      icon: <GapIcon className="h-4 w-4" />,
      tone: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
      text: (
        <>
          Content gap found for <strong>{totalGaps}</strong> keyword{totalGaps === 1 ? "" : "s"} across{" "}
          {groups.length} site{groups.length === 1 ? "" : "s"}.
        </>
      ),
    });
  }
  if (overview.avgRankingPosition !== null) {
    items.push({
      icon: <TrendingUpIcon className="h-4 w-4" />,
      tone: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
      text: (
        <>
          Your average ranking position is <strong>{overview.avgRankingPosition}</strong> across{" "}
          {overview.rankedKeywords} tracked keyword{overview.rankedKeywords === 1 ? "" : "s"}.
        </>
      ),
    });
  }
  if (overview.strikingDistanceCount > 0) {
    items.push({
      icon: <SparkleIcon className="h-4 w-4" />,
      tone: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400",
      text: (
        <>
          <strong>{overview.strikingDistanceCount}</strong> keyword{overview.strikingDistanceCount === 1 ? "" : "s"}{" "}
          rank #11–#20 — close to breaking into page one.
        </>
      ),
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
      <h3 className="text-sm font-semibold mb-3">Recent Insights</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Nothing to report yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.tone}`}>
                {item.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">{item.text}</p>
                {timeLabel && <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{timeLabel}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TopPerformingKeywords({ groups }: { groups: SiteStats[] }) {
  const topKeywords = useMemo(() => {
    const best = new Map<string, number>();
    for (const group of groups) {
      for (const record of latestRecordsByPage(group.records)) {
        for (const q of record.queries) {
          if (q.verifiedRank === null) continue;
          const existing = best.get(q.query);
          if (existing === undefined || q.verifiedRank < existing) best.set(q.query, q.verifiedRank);
        }
      }
    }
    return Array.from(best.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, 5);
  }, [groups]);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
      <h3 className="text-sm font-semibold mb-3">Top Performing Keywords</h3>
      {topKeywords.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No ranked keywords yet.</p>
      ) : (
        <ol className="space-y-2.5">
          {topKeywords.map(([query, rank], i) => (
            <li key={query} className="flex items-center gap-2.5">
              <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}.</span>
              <span className="flex-1 min-w-0 text-sm truncate">{query}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${rankTierClasses(rank)}`}
              >
                #{rank}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function QuickActions({ records }: { records: AnalyzedPageRecord[] }) {
  const actions = [
    {
      label: "Add Website",
      icon: <PlusIcon className="h-4 w-4" />,
      onClick: () => focusQuickStart("full"),
    },
    {
      label: "Track Keywords",
      icon: <SearchIcon className="h-4 w-4" />,
      onClick: () => focusQuickStart("quick"),
    },
    {
      label: "Find Content Gaps",
      icon: <SparkleIcon className="h-4 w-4" />,
      onClick: () => focusQuickStart("full"),
    },
    {
      label: "Generate Report",
      icon: <FileIcon className="h-4 w-4" />,
      onClick: () => download("stealmyserp-history.csv", historyToCsv(records), "text/csv"),
      disabled: records.length === 0,
    },
  ];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
        <ZapIcon className="h-4 w-4 text-gray-400" />
        Quick Actions
      </h3>
      <div className="space-y-1">
        {actions.map((action) => (
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
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- Dashboard -------------------------------- */

export function HistoryDashboard() {
  const [records, setRecords] = useState<AnalyzedPageRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(currentSearch: string) {
    setLoading(true);
    setError("");
    try {
      const params = currentSearch ? `?search=${encodeURIComponent(currentSearch)}` : "";
      const res = await fetch(`/api/history/list${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load history");
      setRecords(data.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Fetch-on-mount: setState happens inside load()'s async continuation,
    // not synchronously in this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load("");
  }, []);

  const groups = useMemo(() => groupBySite(records), [records]);
  const overview = useMemo(() => computeOverview(groups), [groups]);
  const totalGaps = useMemo(
    () => records.reduce((n, r) => n + r.gapReports.reduce((m, g) => m + g.contentGaps.length, 0), 0),
    [records]
  );

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <DashboardStatCard
          icon={<GlobeIcon />}
          tint="indigo"
          label="Total Websites"
          value={overview.totalWebsites}
          sublabel={
            overview.newSitesThisWeek > 0
              ? `${overview.newSitesThisWeek} new this week`
              : `${records.length} page${records.length === 1 ? "" : "s"} analyzed`
          }
          trend={overview.newSitesThisWeek > 0}
        />
        <DashboardStatCard
          icon={<SearchIcon />}
          tint="emerald"
          label="Total Keywords Tracked"
          value={overview.totalKeywords}
          sublabel={`across ${overview.totalWebsites} site${overview.totalWebsites === 1 ? "" : "s"}`}
        />
        <DashboardStatCard
          icon={<TrendingUpIcon />}
          tint="blue"
          label="Avg. Ranking Position"
          value={overview.avgRankingPosition ?? "—"}
          sublabel={`${overview.rankedKeywords} keyword${overview.rankedKeywords === 1 ? "" : "s"} ranked`}
        />
        <DashboardStatCard
          icon={<SparkleIcon />}
          tint="purple"
          label="Top Opportunity"
          value={`${overview.strikingDistanceCount} keywords`}
          sublabel="ranked #11–20, not top 10 yet"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">Monitored Websites</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track performance, find content gaps, and get actionable insights.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search websites..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(search)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => load(search)}
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            Search
          </button>
          <button
            onClick={() => focusQuickStart("full")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm font-medium transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Add Website
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500 mb-2">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => load(search)}
            title="Retry"
            aria-label="Retry loading history"
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <RefreshIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <p className="text-sm text-gray-500">
          No analyzed pages saved yet — run an analysis and it&apos;ll show up here.
        </p>
      )}

      {records.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  <th className="py-3 pl-4 pr-4">Website</th>
                  <th className="py-3 px-3">Keywords</th>
                  <th className="py-3 px-3">Avg Rank</th>
                  <th className="py-3 px-3">Rank Trend</th>
                  <th className="py-3 px-3">Content Gaps</th>
                  <th className="py-3 px-3">Leads</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 pl-3 pr-4" />
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <SiteRow key={group.site} group={group} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RecentInsights groups={groups} totalGaps={totalGaps} latestRecord={records[0]} />
        <TopPerformingKeywords groups={groups} />
        <QuickActions records={records} />
      </div>
    </div>
  );
}
