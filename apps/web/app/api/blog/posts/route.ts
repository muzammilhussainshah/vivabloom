import { NextRequest, NextResponse } from "next/server";
import { getBlogPostsPage } from "@/lib/data";

// Paginated published-post feed for the homepage "Load More Articles" button.
export const dynamic = "force-dynamic";

const MAX_LIMIT = 24;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const skip = Math.max(0, Number.parseInt(searchParams.get("skip") ?? "0", 10) || 0);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "9", 10) || 9;
  const limit = Math.min(Math.max(1, rawLimit), MAX_LIMIT);
  const q = searchParams.get("q") ?? undefined;

  const { posts, total } = await getBlogPostsPage({ skip, limit, q });
  return NextResponse.json({
    posts,
    total,
    hasMore: skip + posts.length < total,
  });
}
