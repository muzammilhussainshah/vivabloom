export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8 md:py-10" aria-busy="true">
      <div className="h-64 animate-pulse rounded-3xl border border-border bg-white" />
      <div className="h-10 w-72 animate-pulse rounded-lg bg-white" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-white" />
      ))}
    </div>
  );
}
