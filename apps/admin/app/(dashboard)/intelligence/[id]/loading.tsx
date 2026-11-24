export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 md:px-8 md:py-10" aria-busy="true">
      <div className="h-9 w-40 animate-pulse rounded-lg bg-white" />
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 animate-pulse rounded-xl bg-white" />
        <div className="h-8 w-64 animate-pulse rounded-lg bg-white" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-44 animate-pulse rounded-2xl border border-border bg-white" />
        <div className="h-44 animate-pulse rounded-2xl border border-border bg-white" />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="h-56 animate-pulse rounded-2xl border border-border bg-white" />
      ))}
    </div>
  );
}
