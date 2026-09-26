import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import Script from "next/script";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

// Runs before hydration so there's no flash of the wrong theme: applies
// any stored preference, otherwise falls back to system preference.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StealMySERP",
  description:
    "Analyze a site's pages, real Google SERPs, content gaps, and outreach contacts — free.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      // The theme-init script below adds/removes "dark" on this element
      // before React hydrates, which would otherwise be flagged as a
      // hydration mismatch — this is the standard, expected pattern for
      // avoiding a flash of the wrong theme (same approach next-themes uses).
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
