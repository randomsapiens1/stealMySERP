"use client";

import { Fragment, useEffect, useState } from "react";
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

function bestRankLabel(record: AnalyzedPageRecord): string {
  const ranks = record.queries
    .filter((q) => !q.serpBlocked && !q.serpError && q.verifiedRank !== null)
    .map((q) => q.verifiedRank as number);
  if (ranks.length === 0) return "—";
  return `#${Math.min(...ranks)}`;
}

export function HistoryDashboard() {
  const [records, setRecords] = useState<AnalyzedPageRecord[]>([]);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
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

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <input
          type="text"
          placeholder="Search by site, page, or topic..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search)}
          className="flex-1 min-w-[200px] rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => load(search)}
          className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          Search
        </button>
        <button
          onClick={() => download("stealmyserp-history.csv", historyToCsv(records), "text/csv")}
          disabled={records.length === 0}
          className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50"
        >
          Export visible rows to CSV
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-gray-200 dark:border-gray-800">
                <th className="py-2 pr-4">Page</th>
                <th className="py-2 pr-4">Primary topic</th>
                <th className="py-2 pr-4">Analyzed</th>
                <th className="py-2 pr-4">Best rank</th>
                <th className="py-2 pr-4">Gaps</th>
                <th className="py-2 pr-4">Contacts</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <Fragment key={record.id}>
                  <tr
                    className="border-b border-gray-100 dark:border-gray-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900"
                    onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                  >
                    <td className="py-2 pr-4 break-all max-w-xs">{record.pageUrl}</td>
                    <td className="py-2 pr-4">{record.primaryTopic || "—"}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {new Date(record.analyzedAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">{bestRankLabel(record)}</td>
                    <td className="py-2 pr-4">
                      {record.gapReports.reduce((n, g) => n + g.contentGaps.length, 0)}
                    </td>
                    <td className="py-2 pr-4">{record.contacts.length}</td>
                    <td className="py-2 pr-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(record.id);
                        }}
                        className="text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  {expandedId === record.id && (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <HistoryDetail record={record} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
