// The extension bridge's AI Overview extraction picks the longest
// text-bearing element near the "AI Overview" label (see extension/
// background.js) — a heuristic that occasionally grabs Google's source-card
// carousel instead of (or duplicated alongside) the actual generated
// summary. That carousel exists in the DOM in both its collapsed and
// expanded states at once, so textContent ends up with something like
// "[cards]Show less[fewer cards]Show all" — the same source cards twice,
// bracketed by the expand/collapse button labels.
const EXPAND_COLLAPSE_MARKERS = ["Show less", "Show all"];

// If the same 90+ character run appears twice, it's a duplicated DOM
// fragment rather than intentional repetition in a real summary. Needs to
// be long enough that it doesn't false-positive on two distinct source
// cards from the same site sharing a title+date prefix (~60-70 chars).
const MIN_DUPLICATE_RUN_LENGTH = 90;

function truncateAtExpandCollapseMarker(text: string): string {
  let cut = text.length;
  for (const marker of EXPAND_COLLAPSE_MARKERS) {
    const idx = text.indexOf(marker);
    if (idx !== -1 && idx < cut) cut = idx;
  }
  return text.slice(0, cut).trim();
}

function truncateAtFirstDuplicateRun(text: string): string {
  for (let start = 0; start + MIN_DUPLICATE_RUN_LENGTH <= text.length; start++) {
    const run = text.slice(start, start + MIN_DUPLICATE_RUN_LENGTH);
    const repeatIdx = text.indexOf(run, start + MIN_DUPLICATE_RUN_LENGTH);
    if (repeatIdx !== -1) return text.slice(0, repeatIdx).trim();
  }
  return text;
}

export function cleanAiOverviewText(raw: string): string {
  const collapsedWhitespace = raw.replace(/\s+/g, " ").trim();
  if (!collapsedWhitespace) return collapsedWhitespace;

  const withoutExpandCollapse = truncateAtExpandCollapseMarker(collapsedWhitespace);
  const deduped = truncateAtFirstDuplicateRun(withoutExpandCollapse);

  // Cleanup can only shorten; never end up with an empty result when the
  // original had content — fall back to the whitespace-collapsed original.
  return deduped.length > 0 ? deduped : collapsedWhitespace;
}
