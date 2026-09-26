"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { MODES, type Mode, modeHref } from "@/lib/shared/modes";

// Lets other dashboard controls (e.g. the Quick Actions panel) jump the
// user here with a mode preselected, instead of duplicating this form.
export const QUICKSTART_FOCUS_EVENT = "sms:focus-quickstart";

export function QuickStartBar() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<Mode>("full");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onFocusRequest(e: Event) {
      const requestedMode = (e as CustomEvent<{ mode?: Mode }>).detail?.mode;
      if (requestedMode) setMode(requestedMode);
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      inputRef.current?.focus();
    }
    window.addEventListener(QUICKSTART_FOCUS_EVENT, onFocusRequest);
    return () => window.removeEventListener(QUICKSTART_FOCUS_EVENT, onFocusRequest);
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    router.push(modeHref(mode, url, 8));
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
      <p className="text-sm font-medium mb-3">Analyze a link</p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          ref={inputRef}
          type="url"
          required
          placeholder="Enter a URL to check — https://yoursite.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-1 rounded-lg border border-gray-200 dark:border-gray-800 p-1 shrink-0">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              title={m.description}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                mode === m.id
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900"
              }`}
            >
              <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={!url.trim()}
          className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start
        </button>
      </form>
    </div>
  );
}
