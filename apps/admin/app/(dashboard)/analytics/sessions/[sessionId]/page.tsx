import Link from "next/link";
import type { Metadata } from "next";
import { getSessionJourney } from "./getSessionJourney";
import { SessionJourneyContent } from "./SessionJourneyContent";

export const metadata: Metadata = { title: "Session journey" };
export const dynamic = "force-dynamic";

export default async function SessionJourneyPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { sessionId } = await params;
  const { returnTo } = await searchParams;
  const data = await getSessionJourney(sessionId);

  // Land back on the exact tab/filters/page you came from, with this
  // session ring-highlighted and scrolled into view — a hard navigation
  // here (e.g. tapping before the page finished hydrating) shouldn't cost
  // you your place in a long, filtered list.
  const backHref = returnTo ? appendHighlight(decodeURIComponent(returnTo), sessionId) : "/analytics";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <Link href={backHref} className="text-sm text-brand-primary hover:underline">
        ← Back to Analytics
      </Link>
      <SessionJourneyContent sessionId={sessionId} {...data} />
    </div>
  );
}

function appendHighlight(url: string, sessionId: string) {
  const [path, query = ""] = url.split("?");
  const search = new URLSearchParams(query);
  search.set("highlight", sessionId);
  return `${path}?${search.toString()}`;
}
