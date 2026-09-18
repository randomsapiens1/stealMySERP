"use client";

import { useMemo, useState } from "react";
import type { PageQueries } from "@/lib/shared/types";

const SOFT_WARNING_THRESHOLD = 8;
const DEFAULT_CHECKED_COUNT = 3;

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "" ? "/" : u.pathname;
  } catch {
    return url;
  }
}

function defaultSelection(pageQueries: PageQueries[]): Set<string> {
  const ranked = pageQueries
    .flatMap((pq) =>
      pq.queries.map((q) => ({
        pageUrl: pq.pageUrl,
        query: q.query,
        confidence: q.confidence,
      })),
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, DEFAULT_CHECKED_COUNT);
  return new Set(ranked.map((q) => `${q.pageUrl}::${q.query}`));
}

export function QuerySelector({
  pageQueries,
  onSubmit,
}: {
  pageQueries: PageQueries[];
  onSubmit: (selected: { pageUrl: string; query: string }[]) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(() =>
    defaultSelection(pageQueries),
  );

  const pagesWithQueries = useMemo(
    () => pageQueries.filter((pq) => pq.queries.length > 0),
    [pageQueries],
  );

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSubmit() {
    const selected = pagesWithQueries.flatMap((pq) =>
      pq.queries
        .filter((q) => checked.has(`${pq.pageUrl}::${q.query}`))
        .map((q) => ({ pageUrl: pq.pageUrl, query: q.query })),
    );
    onSubmit(selected);
  }

  const selectedCount = checked.size;

  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-1">Choose queries to analyze</h2>
      <p className="text-sm text-gray-500 mb-4">
        Every query the AI inferred for each page is listed below. Check the
        ones you want checked against real Google results — each one triggers a
        live SERP fetch, competitor page fetches, and an LLM gap analysis.
      </p>

      {pagesWithQueries.length === 0 ? (
        <p className="text-sm text-gray-500">
          No queries were inferred for any page.
        </p>
      ) : (
        <div className="space-y-4">
          {pagesWithQueries.map((pq) => (
            <div
              key={pq.pageUrl}
              className="border border-gray-200 dark:border-gray-800 rounded-md p-4"
            >
              <div className="text-sm font-mono text-gray-500 mb-1 break-all">
                {pathOf(pq.pageUrl)}
              </div>
              <div className="text-sm mb-3">
                <span className="font-medium">Primary topic:</span>{" "}
                {pq.primaryTopic || "—"}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left border-b border-gray-200 dark:border-gray-800">
                      <th className="py-1.5 pr-4 w-8"></th>
                      <th className="py-1.5 pr-4">
                        Likely query (AI inference)
                      </th>
                      <th className="py-1.5 pr-4">Intent</th>
                      <th className="py-1.5 pr-4">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pq.queries.map((q) => {
                      const key = `${pq.pageUrl}::${q.query}`;
                      return (
                        <tr
                          key={key}
                          className="border-b border-gray-100 dark:border-gray-900"
                        >
                          <td className="py-1.5 pr-4">
                            <input
                              type="checkbox"
                              checked={checked.has(key)}
                              onChange={() => toggle(key)}
                              aria-label={`Analyze "${q.query}"`}
                            />
                          </td>
                          <td className="py-1.5 pr-4">{q.query}</td>
                          <td className="py-1.5 pr-4 text-gray-500">
                            {q.intent}
                          </td>
                          <td className="py-1.5 pr-4">
                            {Math.round(q.confidence * 100)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={selectedCount === 0}
          className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Analyze {selectedCount} selected{" "}
          {selectedCount === 1 ? "query" : "queries"}
        </button>
        {selectedCount > SOFT_WARNING_THRESHOLD && (
          <p className="text-sm text-amber-600 dark:text-amber-500">
            {selectedCount} selected — this will take a while (each one is a
            real SERP fetch + competitor fetches + LLM call).
          </p>
        )}
      </div>
    </section>
  );
}
