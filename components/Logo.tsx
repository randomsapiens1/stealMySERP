// Static local SVG asset — next/image adds no benefit here.
export function Logo({ className = "h-8 w-auto" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.svg" alt="StealMySERP" className={`${className} dark:invert`} />;
}
