import type { Metadata } from "next";
import Link from "next/link";
import { connectToDatabase, Store, Coupon, BlogPost, NewsletterSubscriber } from "@monocoupon/db";
import { auth } from "@/auth";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

async function getDashboardCounts() {
  await connectToDatabase();
  const [storeCount, totalCoupons, activeCoupons, blogPostCount, publishedBlogCount, subscriberCount] =
    await Promise.all([
      Store.countDocuments({}),
      Coupon.countDocuments({}),
      Coupon.countDocuments({ isActive: true }),
      BlogPost.countDocuments({}),
      BlogPost.countDocuments({ status: "published" }),
      NewsletterSubscriber.countDocuments({}),
    ]);

  return {
    storeCount,
    totalCoupons,
    activeCoupons,
    expiredCoupons: totalCoupons - activeCoupons,
    blogPostCount,
    publishedBlogCount,
    subscriberCount,
  };
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-base border border-border bg-surface p-4">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const counts = await getDashboardCounts();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-text-muted">Welcome back, {session?.user?.name ?? session?.user?.email}.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        <StatCard label="Stores" value={counts.storeCount} />
        <StatCard label="Active Coupons" value={counts.activeCoupons} />
        <StatCard label="Expired/Inactive Coupons" value={counts.expiredCoupons} />
        <StatCard label="Total Coupons" value={counts.totalCoupons} />
        <StatCard label="Published Posts" value={counts.publishedBlogCount} />
        <StatCard label="Total Blog Posts" value={counts.blogPostCount} />
        <StatCard label="Newsletter Subscribers" value={counts.subscriberCount} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/stores/new" className="rounded-base bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover">
          + Add Store
        </Link>
        <Link href="/coupons/new" className="rounded-base bg-brand-secondary px-4 py-2 text-sm font-medium text-white hover:bg-brand-secondary-hover">
          + Add Coupon
        </Link>
        <Link href="/categories/new" className="rounded-base border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted">
          + Add Category
        </Link>
        <Link href="/blog/new" className="rounded-base border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted">
          + Add Blog Post
        </Link>
        <Link href="/settings" className="rounded-base border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted">
          Site Settings
        </Link>
      </div>
    </div>
  );
}
