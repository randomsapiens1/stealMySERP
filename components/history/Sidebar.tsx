"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { GlobeIcon, PlugIcon, SearchIcon } from "./icons";

const NAV_ITEMS = [
  {
    href: "/history",
    label: "Dashboard",
    icon: GlobeIcon,
    active: (path: string) => path.startsWith("/history"),
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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden sm:flex w-56 shrink-0 sticky top-0 h-screen flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      <div className="px-5 py-5">
        <Link href="/">
          <Logo className="h-6 w-auto" />
        </Link>
      </div>
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.active(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-50"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900/60"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
