"use client";

import { useEffect, useMemo, useState } from "react";
import { HistoryDetail } from "./HistoryDetail";
import type { AnalyzedPageRecord } from "@/lib/db/history";
import { historyToCsv } from "@/lib/export/historyToCsv";

function download(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function bestRank(record: AnalyzedPageRecord): number | null {
  const ranks = record.queries
    .filter((q) => !q.serpBlocked && !q.serpError && q.verifiedRank !== null)
    .map((q) => q.verifiedRank as number);
  return ranks.length === 0 ? null : Math.min(...ranks);
}

function siteLabel(siteUrl: string): string {
  try {
    return new URL(siteUrl).hostname.replace(/^www\./, "");
  } catch {
    return siteUrl;
  }
}

function pageKey(pageUrl: string): string {
  try {
    const pathname = new URL(pageUrl).pathname;
    const trimmed = pathname.replace(/\/+$/, "");
    return trimmed === "" ? "/" : trimmed;
  } catch {
    return pageUrl;
  }
}

function pagePathLabel(key: string): string {
  return key === "/" ? "/ (home)" : key;
}

function runHeaderLabel(analyzedAt: string): { date: string; time: string } {
  const d = new Date(analyzedAt);
  return {
    date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

/* ---------------------------------- Icons --------------------------------- */

function GlobeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9s1.3-6.4 3.8-9Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function FileIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function GapIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="m12 3 9 16H3l9-16Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
    </svg>
  );
}

function MailIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="m4 6.5 8 6.5 8-6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 4v11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="m7 11 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 20h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
    >
      <path d="M7 5l6 5-6 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* -------------------------------- Rank cell -------------------------------- */

type CellStatus =
  | { kind: "rank"; rank: number }
  | { kind: "not-ranking" }
  | { kind: "unavailable" };

function cellStatus(record: AnalyzedPageRecord): CellStatus {
  const rank = bestRank(record);
  if (rank !== null) return { kind: "rank", rank };
  const hasQueries = record.queries.length > 0;
  const allUnavailable = hasQueries && record.queries.every((q) => q.serpBlocked || q.serpError);
  return allUnavailable ? { kind: "unavailable" } : { kind: "not-ranking" };
}

function rankTierClasses(rank: number): string {
  if (rank <= 3) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
  if (rank <= 10) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
  return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400";
}

function trendFor(current: CellStatus, previous: CellStatus | undefined): "up" | "down" | null {
  if (!previous || current.kind !== "rank" || previous.kind !== "rank") return null;
  if (current.rank < previous.rank) return "up";
  if (current.rank > previous.rank) return "down";
  return null;
}

function RankPill({
  record,
  trend,
  selected,
  onClick,
}: {
  record: AnalyzedPageRecord;
  trend: "up" | "down" | null;
  selected: boolean;
  onClick: () => void;
}) {
  const status = cellStatus(record);

  return (
    <button
      onClick={onClick}
      className={`inline-flex w-full items-center justify-center gap-1 rounded-md py-1.5 transition-colors ${
        selected ? "ring-2 ring-blue-500" : "hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      {status.kind === "rank" && (
        <>
          <span
            className={`inline-flex min-w-[2.25rem] justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${rankTierClasses(status.rank)}`}
          >
            #{status.rank}
          </span>
          {trend === "up" && <span className="text-xs text-emerald-600 dark:text-emerald-400">▲</span>}
          {trend === "down" && <span className="text-xs text-red-500 dark:text-red-400">▼</span>}
        </>
      )}
      {status.kind === "not-ranking" && <span className="text-sm text-gray-400 dark:text-gray-600">–</span>}
      {status.kind === "unavailable" && (
        <span
          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400 dark:bg-gray-800 dark:text-gray-500"
          title="Google search was blocked or errored for every query on this run"
        >
          n/a
        </span>
      )}
    </button>
  );
}

/* --------------------------------- Grouping -------------------------------- */

interface SiteGroup {
  site: string;
  records: AnalyzedPageRecord[];
  lastAnalyzedAt: string;
  bestRank: number | null;
  gapCount: number;
  contactCount: number;
}

function groupBySite(records: AnalyzedPageRecord[]): SiteGroup[] {
  const groups = new Map<string, AnalyzedPageRecord[]>();
  for (const record of records) {
    const key = siteLabel(record.siteUrl);
    const existing = groups.get(key);
    if (existing) existing.push(record);
    else groups.set(key, [record]);
  }

  return Array.from(groups.entries())
    .map(([site, siteRecords]) => {
      const ranks = siteRecords.map(bestRank).filter((r): r is number => r !== null);
      return {
        site,
        records: siteRecords,
        lastAnalyzedAt: siteRecords.reduce(
          (latest, r) => (r.analyzedAt > latest ? r.analyzedAt : latest),
          siteRecords[0].analyzedAt
        ),
        bestRank: ranks.length === 0 ? null : Math.min(...ranks),
        gapCount: siteRecords.reduce((n, r) => n + r.gapReports.reduce((m, g) => m + g.contentGaps.length, 0), 0),
        contactCount: siteRecords.reduce((n, r) => n + r.contacts.length, 0),
      };
    })
    .sort((a, b) => (a.lastAnalyzedAt > b.lastAnalyzedAt ? -1 : 1));
}

interface PivotPage {
  key: string;
  url: string;
}

interface Pivot {
  pages: PivotPage[];
  runs: string[];
  cellFor: (key: string, run: string) => AnalyzedPageRecord | undefined;
}

function cellId(key: string, run: string): string {
  return key + "::" + run;
}

function buildPivot(records: AnalyzedPageRecord[]): Pivot {
  const pages = new Map<string, string>();
  const runs = new Set<string>();
  const cells = new Map<string, AnalyzedPageRecord>();

  for (const record of records) {
    const key = pageKey(record.pageUrl);
    if (!pages.has(key)) pages.set(key, record.pageUrl);
    runs.add(record.analyzedAt);
    cells.set(cellId(key, record.analyzedAt), record);
  }

  return {
    pages: Array.from(pages.entries())
      .map(([key, url]) => ({ key, url }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    runs: Array.from(runs).sort(),
    cellFor: (key, run) => cells.get(cellId(key, run)),
  };
}

/* --------------------------------- UI bits --------------------------------- */

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4 py-3.5 flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</div>
        <div className="text-xl font-semibold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function MetaBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
      {children}
    </span>
  );
}

function SiteSection({
  group,
  selectedId,
  setSelectedId,
  onDelete,
}: {
  group: SiteGroup;
  selectedId: number | null;
  setSelectedId: (id: number | null) => void;
  onDelete: (id: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const pivot = useMemo(() => buildPivot(group.records), [group.records]);
  const selected = group.records.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex flex-wrap items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-gray-900"
      >
        <Chevron open={open} />
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-sm font-semibold uppercase">
          {group.site.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="font-medium truncate">{group.site}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {pivot.pages.length} page{pivot.pages.length === 1 ? "" : "s"} · {pivot.runs.length} analysis
            {pivot.runs.length === 1 ? "" : " runs"} · last {new Date(group.lastAnalyzedAt).toLocaleDateString()}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <MetaBadge>Best {group.bestRank === null ? "—" : `#${group.bestRank}`}</MetaBadge>
          <MetaBadge>{group.gapCount} gaps</MetaBadge>
          <MetaBadge>{group.contactCount} contacts</MetaBadge>
        </div>
      </button>

      {open && (
        <>
          <div className="overflow-x-auto border-t border-gray-200 dark:border-gray-800">
            <table className="text-sm border-collapse w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900">
                  <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 text-left py-2.5 pl-4 pr-4 font-medium text-gray-500 dark:text-gray-400 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    Page
                  </th>
                  {pivot.runs.map((run, i) => {
                    const header = runHeaderLabel(run);
                    const isLatest = i === pivot.runs.length - 1;
                    return (
                      <th
                        key={run}
                        className={`py-2.5 px-3 text-center font-normal min-w-[92px] ${
                          isLatest ? "text-gray-700 dark:text-gray-200" : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        <div className={isLatest ? "font-semibold" : "font-medium"}>{header.date}</div>
                        <div className="text-xs">{header.time}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pivot.pages.map((page) => (
                  <tr
                    key={page.key}
                    className="border-t border-gray-100 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900/60"
                  >
                    <td
                      className="sticky left-0 z-10 bg-white dark:bg-gray-950 py-2 pl-4 pr-4 max-w-[220px] truncate shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                      title={page.url}
                    >
                      {pagePathLabel(page.key)}
                    </td>
                    {pivot.runs.map((run, i) => {
                      const cell = pivot.cellFor(page.key, run);
                      if (!cell) {
                        return (
                          <td key={run} className="py-2 px-3 text-center text-gray-200 dark:text-gray-800">
                            –
                          </td>
                        );
                      }
                      const prevRun = i > 0 ? pivot.runs[i - 1] : null;
                      const prevCell = prevRun ? pivot.cellFor(page.key, prevRun) : undefined;
                      const trend = trendFor(cellStatus(cell), prevCell ? cellStatus(prevCell) : undefined);
                      return (
                        <td key={run} className="py-1 px-2 text-center">
                          <RankPill
                            record={cell}
                            trend={trend}
                            selected={selectedId === cell.id}
                            onClick={() => setSelectedId(selectedId === cell.id ? null : cell.id)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm">
                  <span className="font-medium">{pagePathLabel(pageKey(selected.pageUrl))}</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {" "}
                    — analyzed {new Date(selected.analyzedAt).toLocaleString()}
                  </span>
                </span>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <button
                    onClick={() => {
                      onDelete(selected.id);
                      setSelectedId(null);
                    }}
                    className="text-sm text-red-500 hover:underline"
                  >
                    Delete this analysis
                  </button>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label="Close"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>
              <HistoryDetail record={selected} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* -------------------------------- Dashboard -------------------------------- */

export function HistoryDashboard() {
  const [records, setRecords] = useState<AnalyzedPageRecord[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
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

  async function handleDelete(id: number) {
    await fetch(`/api/history/${id}`, { method: "DELETE" });
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  const groups = useMemo(() => groupBySite(records), [records]);
  const totalGaps = useMemo(
    () => records.reduce((n, r) => n + r.gapReports.reduce((m, g) => m + g.contentGaps.length, 0), 0),
    [records]
  );
  const totalContacts = useMemo(() => records.reduce((n, r) => n + r.contacts.length, 0), [records]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by site, page, or topic..."
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

      {loading && <p className="text-sm text-gray-500">Loading...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && records.length === 0 && (
        <p className="text-sm text-gray-500">
          No analyzed pages saved yet — run an analysis and it&apos;ll show up here.
        </p>
      )}

      {records.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard icon={<GlobeIcon />} label="Sites" value={groups.length} />
            <StatCard icon={<FileIcon />} label="Pages analyzed" value={records.length} />
            <StatCard icon={<GapIcon />} label="Content gaps" value={totalGaps} />
            <StatCard icon={<MailIcon />} label="Contacts found" value={totalContacts} />
          </div>

          <div className="space-y-4">
            {groups.map((group) => (
              <SiteSection
                key={group.site}
                group={group}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                onDelete={(id) => void handleDelete(id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
