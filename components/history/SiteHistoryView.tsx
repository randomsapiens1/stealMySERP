"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalyzedPageRecord, SavedQuery } from "@/lib/db/history";
import { domainOf } from "@/lib/shared/chunk";
import type { ContactInfo, GapReport } from "@/lib/shared/types";
import {
  groupBySite,
  latestRecordsByPage,
  pageKey,
  pagePathLabel,
  rankTierClasses,
  runHeaderLabel,
  siteLabel,
} from "@/lib/history/metrics";
import { ExternalLinkIcon, FileIcon, GapIcon, GlobeIcon, MailIcon, SearchIcon } from "./icons";
import { StatCard } from "./StatCard";

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

function QueryRow({ query, gap }: { query: SavedQuery; gap: GapReport | undefined }) {
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

      {gap?.error && <p className="mt-1.5 text-xs text-red-500">{gap.error}</p>}
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

function AllQueriesRow({ pageUrl, query }: { pageUrl: string; query: SavedQuery }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-gray-100 dark:border-gray-900 last:border-0">
      <div className="min-w-0 text-sm">
        <div className="truncate">{query.query}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {pagePathLabel(pageKey(pageUrl))} · {Math.round(query.confidence * 100)}% conf.
        </div>
      </div>
      <QueryRankBadge query={query} />
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
}: {
  record: AnalyzedPageRecord;
  onDelete: (id: number) => void;
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
            />
          ))
        )}
      </div>
    </div>
  );
}

export function SiteHistoryView({ site }: { site: string }) {
  const [records, setRecords] = useState<AnalyzedPageRecord[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
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
  }, [site]);

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

  async function handleDelete(id: number) {
    await fetch(`/api/history/${id}`, { method: "DELETE" });
    setRecords((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
  }

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (records === null) return <p className="text-sm text-gray-500">Loading...</p>;
  if (records.length === 0 || !stats) {
    return <p className="text-sm text-gray-500">No history found for {site}.</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-semibold uppercase">
          {site.charAt(0)}
        </div>
        <div>
          <h1 className="text-xl font-semibold">{site}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {stats.pageCount} page{stats.pageCount === 1 ? "" : "s"} · {stats.auditCount} audit
            {stats.auditCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        <StatCard
          icon={<GlobeIcon />}
          label="Best rank"
          value={stats.bestRank === null ? "—" : `#${stats.bestRank}`}
          href="#queries"
        />
        <StatCard icon={<FileIcon />} label="Pages tracked" value={stats.pageCount} href="#pages" />
        <StatCard icon={<SearchIcon />} label="Queries tracked" value={queryCount} href="#queries" />
        <StatCard icon={<GapIcon />} label="Content gaps" value={stats.gapCount} href="#pages" />
        <StatCard icon={<MailIcon />} label="Contacts found" value={stats.contactCount} href="#contacts" />
      </div>

      <section id="pages" className="scroll-mt-4 mb-10">
        <h2 className="text-lg font-semibold mb-3">Pages</h2>
        <div className="space-y-4">
          {pages.map((record) => (
            <PageBlock key={pageKey(record.pageUrl)} record={record} onDelete={(id) => void handleDelete(id)} />
          ))}
        </div>
      </section>

      <section id="queries" className="scroll-mt-4 mb-10">
        <h2 className="text-lg font-semibold mb-3">Queries</h2>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4">
          {queryCount === 0 ? (
            <p className="py-3 text-sm text-gray-500">No queries tracked yet.</p>
          ) : (
            pages.flatMap((record) =>
              record.queries.map((q) => (
                <AllQueriesRow key={`${record.pageUrl}::${q.query}`} pageUrl={record.pageUrl} query={q} />
              ))
            )
          )}
        </div>
      </section>

      <section id="contacts" className="scroll-mt-4">
        <h2 className="text-lg font-semibold mb-3">Contacts</h2>
        {contacts.length === 0 ? (
          <p className="text-sm text-gray-500">No outreach contacts found yet.</p>
        ) : (
          <div className="space-y-4">
            {contacts.map((contact) => (
              <ContactCard key={contact.domain} contact={contact} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
