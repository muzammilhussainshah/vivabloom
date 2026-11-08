import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase, BlogPost } from "@monocoupon/db";
import { blogViewEventSchema } from "@monocoupon/validation";
import { checkRateLimit } from "@/lib/rateLimit";

const OK = (views?: number) => NextResponse.json(views === undefined ? { ok: true } : { ok: true, views });

/** Random per-visitor view bump for category-triggered bumps — mocked traffic, not a real count of anything. */
function randomViewBump() {
  return 1 + Math.floor(Math.random() * 50);
}

// Blog-view beacon. Fired from either the blog's own read page (type "blog"
// — every real pageview, no dedup, +1 and the response echoes the new
// authoritative count so the page can display it live) or a coupon/store
// page in that blog's category (type "category" — client-deduped via
// localStorage, mocked random bump, unchanged). Same fire-and-forget
// contract as /api/track and /api/engagement otherwise: never surfaces an
// error, a 4xx, or added latency.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "production" && process.env.TRACK_IN_DEV !== "1") return OK();

  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return OK();
  }

  const parsed = blogViewEventSchema.safeParse(body);
  if (!parsed.success) return OK();

  const rawIp =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;

  const rate = await checkRateLimit(`blog-views:${rawIp ?? "unknown"}`, {
    name: "blog-views",
    requests: 60,
    window: "60 s",
  });
  if (!rate.allowed) return OK();

  const deviceId = request.cookies.get("mc_did")?.value ?? null;
  const sessionId = request.cookies.get("mc_sid")?.value ?? null;
  if (!deviceId || !sessionId) return OK();

  try {
    await connectToDatabase();

    if (parsed.data.type === "blog") {
      const updated = await BlogPost.findOneAndUpdate(
        { slug: parsed.data.id, status: "published" },
        { $inc: { views: 1 } },
        { new: true, projection: "views" }
      ).lean();
      return OK(updated?.views);
    }

    const posts = await BlogPost.find({ category: parsed.data.id, status: "published" }, "_id").lean();
    if (posts.length > 0) {
      await BlogPost.bulkWrite(
        posts.map((post) => ({
          updateOne: { filter: { _id: post._id }, update: { $inc: { views: randomViewBump() } } },
        }))
      );
    }
  } catch (err) {
    console.error("Blog view increment failed", err);
  }

  return OK();
}
