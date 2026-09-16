import { franc } from "franc-min";
import type { Lang } from "./types";

const BANGLA_RANGE = /[ঀ-৿]/g;

export function detectLang(text: string): Lang {
  const sample = text.slice(0, 2000);
  if (sample.trim().length === 0) return "und";

  const banglaChars = sample.match(BANGLA_RANGE)?.length ?? 0;
  const letterChars = sample.replace(/[^\p{L}]/gu, "").length || 1;
  if (banglaChars / letterChars > 0.15) return "bn";

  const code = franc(sample.slice(0, 500));
  if (code === "ben") return "bn";
  if (code === "eng") return "en";
  return "und";
}

export function localeForLang(lang: Lang): { hl: string; gl: string } {
  if (lang === "bn") return { hl: "bn", gl: "bd" };
  return { hl: "en", gl: "us" };
}
