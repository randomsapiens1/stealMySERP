import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Sidebar } from "@/components/history/Sidebar";

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col sm:flex-row">
      <div className="sm:hidden flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <Link href="/">
          <Logo className="h-6 w-auto" />
        </Link>
        <div className="flex gap-4 text-sm font-medium">
          <Link href="/history" className="text-gray-600 dark:text-gray-300">
            Dashboard
          </Link>
          <Link href="/" className="text-gray-600 dark:text-gray-300">
            New check
          </Link>
        </div>
      </div>
      <Sidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
