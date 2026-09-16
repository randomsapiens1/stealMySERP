"use client";

import { contactsToCsv, contentGapsToCsv } from "@/lib/export/toCsv";
import { toMarkdown } from "@/lib/export/toMarkdown";
import type { RunReport } from "@/lib/shared/types";

function download(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButtons({ report }: { report: RunReport }) {
  const slug = report.siteUrl.replace(/^https?:\/\//, "").replace(/[^\w.-]/g, "_");

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => download(`${slug}-report.md`, toMarkdown(report), "text/markdown")}
        className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
      >
        Export Markdown report
      </button>
      <button
        onClick={() => download(`${slug}-content-gaps.csv`, contentGapsToCsv(report), "text/csv")}
        className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
      >
        Export content gaps CSV
      </button>
      <button
        onClick={() => download(`${slug}-contacts.csv`, contactsToCsv(report), "text/csv")}
        className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
      >
        Export contacts CSV
      </button>
    </div>
  );
}
