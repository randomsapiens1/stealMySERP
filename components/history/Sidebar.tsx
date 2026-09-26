"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { AnalyzedPageRecord } from "@/lib/db/history";
import { groupBySite } from "@/lib/history/metrics";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  FileIcon,
  GapIcon,
  GlobeIcon,
  HelpCircleIcon,
  MailIcon,
  PlugIcon,
  SearchIcon,
  SparkleIcon,
  TrendingUpIcon,
} from "./icons";

const NAV_ITEMS = [
  {
    href: "/history",
    label: "Dashboard",
    icon: TrendingUpIcon,
    // Exact match only — the Websites group below takes over "active" for
    // a specific site's page instead of both lighting up at once.
    active: (path: string) => path === "/history",
  },
  {
    href: "/",
    label: "New check",
    icon: SearchIcon,
    active: (path: string) => path === "/",
  },
  {
    href: "/extension",
    label: "Extension bridge",
    icon: PlugIcon,
    active: (path: string) => path.startsWith("/extension"),
  },
];

// Mirrors the target design's fuller nav — these don't have a page behind
// them yet, so they're rendered inert (no href) with a "Soon" tag rather
// than as dead links.
const UPCOMING_NAV_ITEMS = [
  { label: "Content Gaps", icon: GapIcon },
  { label: "Outreach", icon: MailIcon },
  { label: "Rank Tracking", icon: TrendingUpIcon },
  { label: "Reports", icon: FileIcon },
  { label: "Settings", icon: HelpCircleIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [websitesOpen, setWebsitesOpen] = useState(true);
  const [sites, setSites] = useState<string[]>([]);

  const activeSite = pathname.startsWith("/history/") ? decodeURIComponent(pathname.slice("/history/".length)) : null;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/history/list")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const groups = groupBySite((data.pages as AnalyzedPageRecord[]) ?? []);
        setSites(groups.map((g) => g.site));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="hidden sm:flex shrink-0 sticky top-0 h-screen">
      {/* Icon rail — stays put even when the label panel collapses. */}
      <div className="flex w-16 shrink-0 flex-col items-center gap-1.5 bg-[#0a0a0f] py-5">
        <Link
          href="/"
          className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white"
        >
          S
        </Link>
        {NAV_ITEMS.map((item) => {
          const isActive = item.active(pathname);
          return (
            <Link
              key={item.label}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                isActive ? "bg-indigo-500/20 text-indigo-400" : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
              }`}
            >
              <item.icon className="h-[18px] w-[18px]" />
            </Link>
          );
        })}
        <Link
          href="/history"
          title="Websites"
          aria-label="Websites"
          className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
            activeSite ? "bg-indigo-500/20 text-indigo-400" : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
          }`}
        >
          <GlobeIcon className="h-[18px] w-[18px]" />
        </Link>

        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            className="mt-auto flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-white/5 hover:text-gray-300"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5 rotate-180" />
          </button>
        )}
      </div>

      {/* Label panel — collapses to width 0, icon rail alone keeps nav usable. */}
      <div
        className={`flex flex-col overflow-hidden border-l border-white/5 bg-[#111116] transition-[width] duration-200 ${
          collapsed ? "w-0" : "w-60"
        }`}
      >
        <div className="flex w-60 items-center justify-between px-4 py-5">
          <span className="text-sm font-semibold text-gray-100">Dashboard</span>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 text-gray-400 hover:bg-white/5 hover:text-gray-200"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <nav className="w-60 flex-1 space-y-0.5 overflow-y-auto px-3">
          {(() => {
            const dashboard = NAV_ITEMS[0];
            const isActive = dashboard.active(pathname);
            return (
              <Link
                href={dashboard.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-indigo-500/15 text-indigo-400" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <dashboard.icon className="h-4 w-4 shrink-0" />
                {dashboard.label}
              </Link>
            );
          })()}

          <div>
            <button
              type="button"
              onClick={() => setWebsitesOpen((o) => !o)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeSite ? "bg-indigo-500/15 text-indigo-400" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              }`}
            >
              <GlobeIcon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Websites</span>
              <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 transition-transform ${websitesOpen ? "" : "-rotate-90"}`} />
            </button>
            {websitesOpen && (
              <div className="mt-0.5 ml-4 space-y-0.5 border-l border-white/10 pl-3.5">
                {sites.length === 0 ? (
                  <p className="px-3 py-1.5 text-xs text-gray-600">No websites yet</p>
                ) : (
                  sites.map((site) => (
                    <Link
                      key={site}
                      href={`/history/${encodeURIComponent(site)}`}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        activeSite === site
                          ? "bg-indigo-500/15 text-indigo-400 font-medium"
                          : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${activeSite === site ? "bg-indigo-400" : "bg-gray-700"}`}
                      />
                      <span className="truncate">{site}</span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>

          {NAV_ITEMS.slice(1).map((item) => {
            const isActive = item.active(pathname);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-indigo-500/15 text-indigo-400" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}

          <div className="mt-2 space-y-0.5 border-t border-white/5 pt-2">
            {UPCOMING_NAV_ITEMS.map((item) => (
              <div
                key={item.label}
                title="Coming soon"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 cursor-default select-none"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                <span className="text-[10px] font-normal uppercase tracking-wide text-gray-600">Soon</span>
              </div>
            ))}
          </div>
        </nav>

        <div className="m-3 w-[208px] rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
          <SparkleIcon className="h-5 w-5 text-indigo-400 mb-2" />
          <p className="text-sm font-semibold text-gray-100 leading-snug">
            Smarter SEO.
            <br />
            Bigger opportunities.
          </p>
          <p className="text-xs text-gray-400 mt-1.5 leading-snug">
            Track, analyze, and find what matters — all in one place.
          </p>
        </div>
      </div>
    </aside>
  );
}
