"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AnalyzedPageRecord } from "@/lib/db/history";
import { historyToCsv } from "@/lib/export/historyToCsv";
import { groupBySite, relativeTimeFromNow, type SiteStats } from "@/lib/history/metrics";
import { DashboardStatCard } from "./DashboardStatCard";
import { DownloadIcon, GapIcon, GlobeIcon, MailIcon, RefreshIcon, SearchIcon } from "./icons";
import { MetricBar } from "./ScoreRing";

function download(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function IssuePill({
  tone,
  children,
}: {
  tone: "amber" | "blue" | "neutral";
  children: React.ReactNode;
}) {
  const toneClasses = {
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
    neutral: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  }[tone];

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${toneClasses}`}>
      {children}
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
      <td className="py-3 px-3">
        <MetricBar value={group.top3Pct} />
      </td>
      <td className="py-3 px-3">
        <MetricBar value={group.top10Pct} />
      </td>
      <td className="py-3 px-3">
        <MetricBar value={group.coveragePct} />
      </td>
      <td className="py-3 px-3">
        <div className="flex flex-wrap gap-1.5">
          {group.gapCount > 0 && <IssuePill tone="amber">{group.gapCount} gaps</IssuePill>}
          {group.contactCount > 0 && <IssuePill tone="blue">{group.contactCount} contacts</IssuePill>}
          {group.gapCount === 0 && group.contactCount === 0 && <IssuePill tone="neutral">clean</IssuePill>}
        </div>
      </td>
      <td className="py-3 pl-3 pr-4 text-right">
        <Link
          href={`/history/${encodeURIComponent(group.site)}`}
          className="inline-flex items-center rounded-md bg-gray-900 dark:bg-gray-100 px-3 py-1.5 text-xs font-medium text-white dark:text-gray-900 hover:opacity-90"
        >
          View
        </Link>
      </td>
    </tr>
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
  const totalGaps = useMemo(
    () => records.reduce((n, r) => n + r.gapReports.reduce((m, g) => m + g.contentGaps.length, 0), 0),
    [records]
  );
  const totalContacts = useMemo(() => records.reduce((n, r) => n + r.contacts.length, 0), [records]);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <DashboardStatCard
          icon={<GlobeIcon />}
          label="Sites monitored"
          value={groups.length}
          sublabel={`${records.length} page${records.length === 1 ? "" : "s"} analyzed`}
        />
        <DashboardStatCard
          icon={<GapIcon />}
          label="Content gaps"
          value={totalGaps}
          sublabel="Across all sites"
        />
        <DashboardStatCard
          icon={<MailIcon />}
          label="Contacts found"
          value={totalContacts}
          sublabel="Outreach leads"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold">Monitored Websites</h2>
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
            onClick={() => download("stealmyserp-history.csv", historyToCsv(records), "text/csv")}
            disabled={records.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50"
          >
            <DownloadIcon />
            Export CSV
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
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  <th className="py-3 pl-4 pr-4">Website</th>
                  <th className="py-3 px-3">Top 3</th>
                  <th className="py-3 px-3">Top 10</th>
                  <th className="py-3 px-3">Coverage</th>
                  <th className="py-3 px-3">Issues</th>
                  <th className="py-3 pl-3 pr-4 text-right">Actions</th>
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
    </div>
  );
}
