import Link from "next/link";
import { Logo } from "@/components/Logo";

const STEPS = [
  {
    title: "Download the extension",
    body: "Grab stealmyserp-extension.zip and unzip it anywhere on your computer.",
  },
  {
    title: "Open Chrome's extensions page",
    body: "Go to chrome://extensions in your address bar.",
  },
  {
    title: "Turn on Developer mode",
    body: "Toggle it on in the top-right corner of that page.",
  },
  {
    title: "Click “Load unpacked”",
    body: "Select the unzipped stealmyserp-extension folder (the one containing manifest.json).",
  },
  {
    title: "That's it",
    body: "Come back and run an analysis — it'll automatically use your logged-in Chrome session for Google results instead of the built-in scraper, which Google blocks far more easily.",
  },
];

export default function ExtensionPage() {
  return (
    <main className="flex-1 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex justify-center mb-6">
          <Logo className="h-14 w-auto" />
        </div>

        <h1 className="text-xl font-semibold mb-1">Get more reliable results</h1>
        <p className="text-sm text-gray-500 mb-8">
          The built-in Google search fetcher runs from a server and gets blocked or
          rate-limited fairly easily. Installing this small, free Chrome extension lets
          analyses use your own, already-logged-in browser session instead — the same
          way you&apos;d search normally, which Google doesn&apos;t block nearly as
          often. It only runs when you ask for an analysis, and only talks to
          google.com.
        </p>

        <a
          href="/stealmyserp-extension.zip"
          download
          className="inline-block rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 text-sm transition-colors mb-8"
        >
          Download extension (.zip)
        </a>

        <ol className="space-y-5 mb-8">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium">
                {i + 1}
              </span>
              <div>
                <div className="text-sm font-medium">{step.title}</div>
                <p className="text-sm text-gray-500">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="text-xs text-gray-400 dark:text-gray-500 mb-8">
          This isn&apos;t published on the Chrome Web Store, so Chrome will show a
          &quot;Developer mode extensions&quot; warning — that&apos;s expected for
          any unpacked extension and not specific to this one. The source is fully
          visible in the download and in the project&apos;s repository.
        </p>

        <Link
          href="/"
          className="inline-block rounded-md border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          ← Back to analyze
        </Link>
      </div>
    </main>
  );
}
