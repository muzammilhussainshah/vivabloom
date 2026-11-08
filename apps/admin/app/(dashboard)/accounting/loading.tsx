/**
 * Shown while the /accounting page's data is loading — on the initial load,
 * and again on every tab switch, since a tab change is just a `?tab=` query
 * change to this same page (it's `force-dynamic`, so each one re-fetches).
 */
export default function AccountingLoading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 px-4 py-24 text-text-muted">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-brand-primary" />
      <p className="text-sm">Loading…</p>
    </div>
  );
}
