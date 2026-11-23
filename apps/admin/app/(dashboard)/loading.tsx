import { PageShell } from "@/components/ui";

function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl border border-border bg-white ${className}`} />;
}

/** Dashboard skeleton — also the fallback for any admin route without its own loading.tsx. */
export default function Loading() {
  return (
    <PageShell>
      <div className="flex flex-col gap-2" aria-hidden="true">
        <div className="h-4 w-40 animate-pulse rounded bg-border/60" />
        <div className="h-8 w-64 animate-pulse rounded-lg bg-border/70" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <Block key={i} className="h-[132px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3" role="status" aria-label="Loading">
        <Block className="h-[330px] xl:col-span-2" />
        <Block className="h-[330px]" />
        <span className="sr-only">Loading…</span>
      </div>
    </PageShell>
  );
}
