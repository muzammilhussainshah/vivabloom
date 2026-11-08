import { cache } from "react";
import { connectToDatabase, Category, Store, Coupon, Product, Bundle, BlogPost, getSiteSettings } from "@monocoupon/db";

/** Strips Mongoose-specific types (ObjectId, Date) down to plain JSON-safe values. */
function serialize<T>(doc: unknown): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}

/** Escapes user input so it can be used literally inside a RegExp (search). */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface SiteSettingsData {
  siteName: string;
  tagline: string;
  heroOverline?: string;
  heroDescription?: string;
  heroImage?: string | null;
  themeTokens: {
    brandPrimary: string;
    brandSecondary: string;
    brandAccent: string;
    surface: string;
    surfaceMuted: string;
    text: string;
    textMuted: string;
    border: string;
    footerBg: string;
    radiusBase: string;
  };
  contact: { email?: string | null; phone?: string | null; address?: string | null };
  socialLinks: { facebook?: string | null; instagram?: string | null; youtube?: string | null; tiktok?: string | null; discord?: string | null };
  integrations: {
    ga4Id?: string | null;
    gtmId?: string | null;
    googleAdsConversionId?: string | null;
    googleAdsConversionLabel?: string | null;
    clarityId?: string | null;
  };
}

/** Deduped per-request: layout and pages can both call this without double-querying. */
export const getCachedSiteSettings = cache(async (): Promise<SiteSettingsData> => {
  await connectToDatabase();
  const settings = await getSiteSettings();
  return serialize<SiteSettingsData>(settings);
});

export interface CategoryCard {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
  storeCount?: number;
  postCount?: number;
  /** Admin-authored square tile image (distinct from the smaller `icon` field, which nothing in apps/web renders). */
  image?: string | null;
}

export interface StoreRef {
  _id: string;
  name: string;
  slug: string;
}

export interface StoreCard {
  _id: string;
  name: string;
  slug: string;
  logo?: string | null;
  description?: string;
  shortDescription?: string;
  isFeatured?: boolean;
  categories?: StoreRef[];
  websiteUrl?: string;
  stats?: {
    totalCoupons: number;
    activeDeals: number;
    views: number;
    rating: number;
    joinedDate?: string;
  };
  faqs?: FaqItem[];
  /** The store-page redesign's single offer — see apps/web/lib/offerContent.ts for how this gets merged with derived defaults. */
  offer?: StoreOfferRaw;
  /** Country-specific overrides, one entry per country this store has been localized for — see apps/web/lib/offerContent.ts. */
  i18n?: StoreLocaleOfferRaw[];
}

export interface FaqItem {
  question: string;
  answer: string;
  sortOrder: number;
}

/** Raw Store.offer shape as stored in Mongo — see apps/web/lib/offerContent.ts for how it's merged with derived defaults into a full DerivedOffer. */
export interface StoreOfferRaw {
  mechanic?: "link" | "code" | "popup" | null;
  code?: string | null;
  affiliateUrl?: string | null;
  discountLabel?: string | null;
  discountSuffix?: string | null;
  offerSubline?: string | null;
  lede?: string | null;
  verifiedDate?: string | null;
  nextCheckDate?: string | null;
  verifierName?: string | null;
  usageCount?: string | null;
  trustChecks?: string[];
  notOffered?: string[];
  proofScreenshots?: string[];
}

/**
 * A country-specific override of StoreOfferRaw, plus faqs/meta. Every field
 * optional — apps/web/lib/offerContent.ts falls back field-by-field to the
 * base StoreOfferRaw (and from there to the usual English-derived defaults)
 * for anything left unset here.
 */
export interface StoreLocaleOfferRaw {
  country: string;
  mechanic?: "link" | "code" | "popup" | null;
  code?: string | null;
  affiliateUrl?: string | null;
  discountLabel?: string | null;
  discountSuffix?: string | null;
  offerSubline?: string | null;
  lede?: string | null;
  verifiedDate?: string | null;
  nextCheckDate?: string | null;
  verifierName?: string | null;
  usageCount?: string | null;
  trustChecks?: string[];
  notOffered?: string[];
  faqs?: FaqItem[];
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface CouponCard {
  _id: string;
  title: string;
  description?: string;
  /** Country-specific title/description overrides — see apps/web/components/store/AllDealsSection.tsx for the fallback-to-English resolution. */
  i18n?: CouponLocaleRaw[];
  code?: string | null;
  type: "code" | "deal";
  discountType?: string;
  discountValue?: number | null;
  merchantUrl: string;
  affiliateUrl?: string | null;
  isVerified?: boolean;
  isExclusive?: boolean;
  isFeatured?: boolean;
  lastCheckedAt?: string | null;
  expiryDate?: string | null;
}

export interface CouponLocaleRaw {
  country: string;
  title?: string | null;
  description?: string | null;
  code?: string | null;
  affiliateUrl?: string | null;
}

export interface ProductCard {
  _id: string;
  name: string;
  slug: string;
  image: string;
  price: number;
  originalPrice?: number | null;
  storeSlug: string;
  productUrl: string;
  /** Country-specific referral-link overrides — see apps/web/lib/catalogItems.ts for the fallback-to-English resolution. */
  i18n?: ProductLocaleRaw[];
}

export interface ProductLocaleRaw {
  country: string;
  productUrl?: string | null;
}

export interface BundleCard {
  _id: string;
  name: string;
  /** Shares the /products/[slug] URL space with Product — a bundle is presented as "just another product" there. */
  slug: string;
  image: string;
  price: number;
  originalPrice?: number | null;
  extraDiscountPercent?: number | null;
  storeSlug: string;
  bundleUrl: string;
  bundleDetailsUrl: string;
  /** Country-specific referral-link overrides — see apps/web/lib/catalogItems.ts for the fallback-to-English resolution. */
  i18n?: BundleLocaleRaw[];
}

export interface BundleLocaleRaw {
  country: string;
  bundleUrl?: string | null;
  bundleDetailsUrl?: string | null;
}

/**
 * The /products/[slug] detail page's normalized shape — a product and a
 * bundle are presented identically there ("a bundle is just another
 * product"), so this flattens whichever one was found into one interface
 * rather than the page having to branch on kind for every field.
 */
export interface CatalogDetail {
  kind: "product" | "bundle";
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image: string;
  price: number;
  originalPrice?: number | null;
  /** Bundle-only marketing badge ("extra 7% off") — undefined for a product. */
  extraDiscountPercent?: number | null;
  /** The outbound affiliate/purchase URL — Product.productUrl or Bundle.bundleUrl. */
  url: string;
  /** Bundle-only: a second external link to the merchant's own bundle page — undefined for a product. */
  detailsUrl?: string | null;
  store: StoreRef & { logo?: string | null; websiteUrl?: string };
  /** The store's top active coupon, if any — reused for the same copy-code-then-navigate flow as the store page. */
  storeCoupon?: CouponCard | null;
}

/** Minimal shape for a populated `category` field — a Category doc used just for its name/slug/id. */
export interface CategoryRef {
  _id: string;
  name: string;
  slug: string;
}

export interface BlogPostCard {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  coverImage?: string | null;
  category?: CategoryRef;
  author?: string;
  publishedAt?: string | null;
  /** Mocked view count, not real analytics. */
  views?: number;
}

export interface BlogPostDetail extends BlogPostCard {
  content: string;
  tags?: string[];
  relatedStores?: StoreRef[];
}

/** Category list with both store and published-post counts — categories are shared by stores and blog posts. */
export async function getAllCategories() {
  await connectToDatabase();
  const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
  const [storeCounts, postCounts] = await Promise.all([
    Promise.all(categories.map((c) => Store.countDocuments({ categories: c._id, isActive: true }))),
    Promise.all(categories.map((c) => BlogPost.countDocuments({ category: c._id, status: "published" }))),
  ]);
  const withCounts = categories.map((c, i) => ({ ...c, storeCount: storeCounts[i], postCount: postCounts[i] }));
  return serialize<CategoryCard[]>(withCounts);
}

export async function getAllCategorySlugs() {
  await connectToDatabase();
  const categories = await Category.find({ isActive: true }, "slug").lean();
  return categories.map((c) => c.slug);
}

/** Name + slug only, for the header nav's Categories dropdown — no per-category count queries. */
export async function getCategoriesForNav() {
  await connectToDatabase();
  const categories = await Category.find({ isActive: true }, "name slug").sort({ sortOrder: 1 }).lean();
  return serialize<CategoryRef[]>(categories);
}

/** A category's page: matching active stores and published blog posts together. */
export async function getCategoryDetail(slug: string) {
  await connectToDatabase();
  const category = await Category.findOne({ slug, isActive: true }).lean();
  if (!category) return null;
  const [stores, posts] = await Promise.all([
    Store.find({ categories: category._id, isActive: true }).sort({ isFeatured: -1, sortOrder: 1, name: 1 }).lean(),
    BlogPost.find({ category: category._id, status: "published" }).sort({ publishedAt: -1 }).lean(),
  ]);
  // $sample picks a random 12 rather than always the newest — once a
  // category has hundreds of products across its stores, a fixed sort would
  // mean the same handful get all the exposure forever.
  const products = await Product.aggregate([
    { $match: { store: { $in: stores.map((s) => s._id) }, isActive: true } },
    { $sample: { size: 12 } },
  ]);
  return {
    category: serialize<CategoryCard>(category),
    stores: serialize<StoreCard[]>(stores),
    posts: serialize<BlogPostCard[]>(posts),
    products: serialize<ProductCard[]>(products),
  };
}

export async function getAllStores() {
  await connectToDatabase();
  const stores = await Store.find({ isActive: true })
    .populate("categories", "name slug")
    .sort({ isFeatured: -1, sortOrder: 1, name: 1 })
    .lean();
  return serialize<StoreCard[]>(stores);
}

export interface DealsIndexEntry {
  store: StoreCard;
  /** This store's top-priority active coupon, if it has one — same selection deriveOffer's callers use as `coupons[0]` on /stores/[slug]. */
  coupon: CouponCard | null;
  /** Up to 3 of this store's active products, to surface alongside its voucher on the /deals index. */
  products: ProductCard[];
  /** Up to 3 of this store's active bundles — mixed in with `products` (capped at 3 combined) by the card that renders them, same "one upsell mixed into the product strip" pattern as StoreHero's buildHeroItems. */
  bundles: BundleCard[];
}

/**
 * One row per active store for the /deals index: its top coupon and a
 * handful of products/bundles, fetched in bulk (3 aggregations, not one
 * query per store) rather than via getStoreDetail's per-store Promise.all,
 * which would mean N+1 round-trips across every store on the site.
 */
export async function getDealsIndex(): Promise<{ entries: DealsIndexEntry[]; categories: CategoryCard[] }> {
  await connectToDatabase();
  const [stores, categories] = await Promise.all([
    Store.find({ isActive: true }).populate("categories", "name slug").sort({ isFeatured: -1, sortOrder: 1, name: 1 }).lean(),
    Category.find({ isActive: true }, "name slug").sort({ sortOrder: 1 }).lean(),
  ]);
  const storeIds = stores.map((s) => s._id);

  const [topCoupons, topProducts, topBundles] = await Promise.all([
    Coupon.aggregate([
      { $match: { store: { $in: storeIds }, isActive: true } },
      { $sort: { isFeatured: -1, sortOrder: 1 } },
      { $group: { _id: "$store", top: { $first: "$$ROOT" } } },
    ]),
    Product.aggregate([
      { $match: { store: { $in: storeIds }, isActive: true } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$store", items: { $push: "$$ROOT" } } },
      { $project: { items: { $slice: ["$items", 3] } } },
    ]),
    Bundle.aggregate([
      { $match: { store: { $in: storeIds }, isActive: true } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$store", items: { $push: "$$ROOT" } } },
      { $project: { items: { $slice: ["$items", 3] } } },
    ]),
  ]);

  const couponByStore = new Map(topCoupons.map((row) => [String(row._id), row.top]));
  const productsByStore = new Map(topProducts.map((row) => [String(row._id), row.items]));
  const bundlesByStore = new Map(topBundles.map((row) => [String(row._id), row.items]));

  const entries = stores.map((store) => ({
    store: serialize<StoreCard>(store),
    coupon: serialize<CouponCard | null>(couponByStore.get(String(store._id)) ?? null),
    products: serialize<ProductCard[]>(productsByStore.get(String(store._id)) ?? []),
    bundles: serialize<BundleCard[]>(bundlesByStore.get(String(store._id)) ?? []),
  }));

  return { entries, categories: serialize<CategoryCard[]>(categories) };
}

export async function getAllStoreSlugs() {
  await connectToDatabase();
  const stores = await Store.find({ isActive: true }, "slug").lean();
  return stores.map((s) => s.slug);
}

/**
 * Fallback lookup for when a slug doesn't match any store's current slug —
 * checks whether it's a slug the store used to have before a rename, so the
 * page can redirect to the current URL instead of 404ing. Only active stores.
 */
export async function getStoreSlugRedirect(slug: string): Promise<string | null> {
  await connectToDatabase();
  const store = await Store.findOne({ previousSlugs: slug, isActive: true }, "slug").lean();
  return store?.slug ?? null;
}

/**
 * Wrapped in React's cache() so both app/(store)/layout.tsx (for the header's
 * persistent offer summary) and the page component can call this for the
 * same slug within one request without double-querying Mongo.
 */
export const getStoreDetail = cache(async (slug: string) => {
  await connectToDatabase();
  const store = await Store.findOne({ slug, isActive: true }).populate("categories", "name slug").lean();
  if (!store) return null;

  const [coupons, products, bundles, relatedPosts] = await Promise.all([
    Coupon.find({ store: store._id, isActive: true }).sort({ isFeatured: -1, sortOrder: 1 }).lean(),
    Product.find({ store: store._id, isActive: true }).sort({ createdAt: -1 }).lean(),
    Bundle.find({ store: store._id, isActive: true }).sort({ createdAt: -1 }).lean(),
    BlogPost.find({ relatedStores: store._id, status: "published" })
      .populate("category", "name slug")
      .sort({ publishedAt: -1 })
      .limit(3)
      .lean(),
  ]);

  return {
    store: serialize<StoreCard>(store),
    coupons: serialize<CouponCard[]>(coupons),
    products: serialize<ProductCard[]>(products),
    bundles: serialize<BundleCard[]>(bundles),
    relatedPosts: serialize<BlogPostCard[]>(relatedPosts),
  };
});

export async function getPublishedBlogPosts() {
  await connectToDatabase();
  const posts = await BlogPost.find({ status: "published" })
    .populate("category", "name slug")
    .sort({ publishedAt: -1 })
    .lean();
  return serialize<BlogPostCard[]>(posts);
}

export async function getAllBlogPostSlugs() {
  await connectToDatabase();
  const posts = await BlogPost.find({ status: "published" }, "slug").lean();
  return posts.map((p) => p.slug);
}

export async function getBlogPost(slug: string) {
  await connectToDatabase();
  const post = await BlogPost.findOne({ slug, status: "published" })
    .populate("category", "name slug")
    .populate("relatedStores", "name slug")
    .lean();
  if (!post) return null;

  const category = post.category as unknown as { _id: unknown } | undefined;
  const [relatedPosts, relatedProducts] = await Promise.all([
    category
      ? BlogPost.find({
          _id: { $ne: post._id },
          category: category._id,
          status: "published",
        })
          .sort({ publishedAt: -1 })
          .limit(5)
          .lean()
      : [],
    // Products sold by stores in the same category — a reader interested in
    // this article's topic is a plausible buyer for these, so they're worth
    // surfacing as a "you might like" upsell alongside the related articles.
    // $sample picks a random 6 each time rather than always the newest —
    // once there are hundreds of products, a fixed sort would mean the same
    // handful get all the exposure forever.
    category
      ? Store.find({ categories: category._id, isActive: true }, "_id")
          .lean()
          .then((stores) =>
            Product.aggregate([
              { $match: { store: { $in: stores.map((s) => s._id) }, isActive: true } },
              { $sample: { size: 6 } },
            ])
          )
      : [],
  ]);

  return {
    post: serialize<BlogPostDetail>(post),
    relatedPosts: serialize<BlogPostCard[]>(relatedPosts),
    relatedProducts: serialize<ProductCard[]>(relatedProducts),
  };
}

export interface BlogCategorySection {
  category: CategoryRef & { description?: string };
  posts: BlogPostCard[];
}

/**
 * A page of published blog posts, newest first — powers both the homepage
 * "all articles" grid (with Load More) and the /blog search results.
 * `q` does a case-insensitive match against title and excerpt.
 */
export async function getBlogPostsPage({
  skip = 0,
  limit = 9,
  q,
}: {
  skip?: number;
  limit?: number;
  q?: string;
}): Promise<{ posts: BlogPostCard[]; total: number }> {
  await connectToDatabase();
  const filter: Record<string, unknown> = { status: "published" };
  const trimmed = q?.trim();
  if (trimmed) {
    const rx = new RegExp(escapeRegex(trimmed), "i");
    filter.$or = [{ title: rx }, { excerpt: rx }];
  }

  const [posts, total] = await Promise.all([
    BlogPost.find(filter)
      .populate("category", "name slug")
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    BlogPost.countDocuments(filter),
  ]);

  return { posts: serialize<BlogPostCard[]>(posts), total };
}

/** A category tile for the homepage's archive mosaic — live post count plus the admin-authored square tile image. */
export interface HomeCategoryTile extends CategoryRef {
  postCount: number;
  image?: string | null;
}

/**
 * Everything the blog-first homepage needs in one round of queries: a
 * data-driven "featured story" hero (the single highest-viewed post) with a
 * "Next Up" list beside it, a "most read" band (ranked by views), the top 3
 * category spotlights, the full category list (with live post counts) for
 * the archive mosaic, and the first page (+ total) of all articles.
 */
export async function getBlogHomeData() {
  await connectToDatabase();

  const [topByViews, allCategories, counts] = await Promise.all([
    BlogPost.find({ status: "published" })
      .populate("category", "name slug")
      .sort({ views: -1 })
      .limit(6)
      .lean(),
    Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean(),
    BlogPost.aggregate<{ _id: unknown; count: number }>([
      { $match: { status: "published" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  // The single most-viewed published post becomes the hero; the next 5
  // most-viewed (excluding it) fill the "Most Read" band.
  const featuredDoc = topByViews[0] ?? null;
  const mostReadDocs = topByViews.slice(1, 6);
  const excludeIds = featuredDoc ? [featuredDoc._id] : [];

  const [latestDocs, initialPage] = await Promise.all([
    // Newest posts (excluding the featured one) — the hero's "Next Up" list.
    BlogPost.find({ status: "published", _id: { $nin: excludeIds } })
      .populate("category", "name slug")
      .sort({ publishedAt: -1 })
      .limit(4)
      .lean(),
    getBlogPostsPage({ skip: 0, limit: 9 }),
  ]);

  // Build up to 3 category spotlights (busiest categories first), each led
  // by its own best-performing (most-viewed) published post.
  const topCatIds = counts.filter((c) => c.count > 0).slice(0, 3).map((c) => c._id);
  const sectionsRaw = await Promise.all(
    topCatIds.map(async (id) => {
      const cat = allCategories.find((c) => String(c._id) === String(id));
      if (!cat) return null;
      const posts = await BlogPost.find({ category: id, status: "published", _id: { $nin: excludeIds } })
        .sort({ views: -1 })
        .limit(3)
        .lean();
      return { category: cat, posts };
    })
  );
  const categorySections = sectionsRaw.filter((s): s is NonNullable<typeof s> => s !== null);

  const countByCategory = new Map(counts.map((c) => [String(c._id), c.count]));
  const browseCategories = allCategories.map((c) => ({
    ...c,
    postCount: countByCategory.get(String(c._id)) ?? 0,
  }));

  return {
    featuredPost: featuredDoc ? serialize<BlogPostCard>(featuredDoc) : null,
    latestPosts: serialize<BlogPostCard[]>(latestDocs),
    mostReadPosts: serialize<BlogPostCard[]>(mostReadDocs),
    categorySections: serialize<BlogCategorySection[]>(categorySections),
    browseCategories: serialize<HomeCategoryTile[]>(browseCategories),
    initialPosts: initialPage.posts,
    totalPosts: initialPage.total,
  };
}

/** A product or bundle, tagged so a mixed list/grid can render + link each correctly — bundles have no internal detail page, so they link straight out to `bundleUrl` same as everywhere else on the site; products link to their own `/products/[slug]`. */
export type CatalogItem = { kind: "bundle"; data: BundleCard } | { kind: "product"; data: ProductCard };

export interface StoreCatalogGroup {
  store: StoreRef & { logo?: string | null; shortDescription?: string; categories?: CategoryRef[] };
  /** Bundle first (if the store has one), then products, newest first — the ordering the /products spotlight layout assumes when picking its "lead" item. */
  items: CatalogItem[];
}

/**
 * The /products listing page's default (no search) view: every active
 * store's products + bundles together, grouped per store so the page can
 * render each store as its own spotlight block (mirrors the blog homepage's
 * per-category spotlight treatment) rather than one flat undifferentiated
 * grid. Stores with zero active products/bundles are omitted.
 */
export async function getProductCatalogGroups(): Promise<StoreCatalogGroup[]> {
  await connectToDatabase();
  const [products, bundles, stores] = await Promise.all([
    Product.find({ isActive: true }).sort({ createdAt: -1 }).lean(),
    Bundle.find({ isActive: true }).sort({ createdAt: -1 }).lean(),
    Store.find({ isActive: true }, "name slug logo shortDescription categories")
      .populate("categories", "name slug")
      .sort({ isFeatured: -1, sortOrder: 1, name: 1 })
      .lean(),
  ]);

  const productsByStore = new Map<string, typeof products>();
  for (const p of products) {
    const key = String(p.store);
    productsByStore.set(key, [...(productsByStore.get(key) ?? []), p]);
  }
  const bundlesByStore = new Map<string, typeof bundles>();
  for (const b of bundles) {
    const key = String(b.store);
    bundlesByStore.set(key, [...(bundlesByStore.get(key) ?? []), b]);
  }

  const groups: StoreCatalogGroup[] = [];
  for (const store of stores) {
    const storeId = String(store._id);
    const storeBundles = bundlesByStore.get(storeId) ?? [];
    const storeProducts = productsByStore.get(storeId) ?? [];
    if (storeBundles.length === 0 && storeProducts.length === 0) continue;
    const items: CatalogItem[] = [
      ...storeBundles.map((b) => ({ kind: "bundle" as const, data: serialize<BundleCard>(b) })),
      ...storeProducts.map((p) => ({ kind: "product" as const, data: serialize<ProductCard>(p) })),
    ];
    groups.push({ store: serialize<StoreCatalogGroup["store"]>(store), items });
  }
  return groups;
}

/** Every active product + bundle slug — both kinds live at /products/[slug], so generateStaticParams needs both. */
export async function getAllCatalogSlugs() {
  await connectToDatabase();
  const [products, bundles] = await Promise.all([
    Product.find({ isActive: true }, "slug").lean(),
    Bundle.find({ isActive: true }, "slug").lean(),
  ]);
  return [...products.map((p) => p.slug), ...bundles.map((b) => b.slug)];
}

type StorePopulated = {
  _id: unknown;
  name: string;
  slug: string;
  logo?: string | null;
  websiteUrl?: string;
  categories?: unknown[];
};

/**
 * /products/[slug]'s data: tries Product first, then Bundle — whichever
 * matches is normalized into one CatalogDetail (a bundle is presented as
 * "just another product" here, per the user's explicit ask), alongside its
 * store (for the header + CTA), that store's top coupon (so the CTA can
 * reuse the same copy-code-then-navigate flow as the store page), and a set
 * of related items — same store first (mixing in the store's other
 * products/bundles), topped up from other stores sharing a category when
 * the store alone doesn't have enough.
 */
export async function getProductBySlug(slug: string): Promise<{
  item: CatalogDetail;
  relatedItems: CatalogItem[];
} | null> {
  await connectToDatabase();
  const [productDoc, bundleDoc] = await Promise.all([
    Product.findOne({ slug, isActive: true }).populate("store", "name slug logo websiteUrl categories").lean(),
    Bundle.findOne({ slug, isActive: true }).populate("store", "name slug logo websiteUrl categories").lean(),
  ]);
  if (!productDoc && !bundleDoc) return null;

  const doc = productDoc ?? bundleDoc!;
  const store = doc.store as unknown as StorePopulated;

  const [coupons, sameStoreProducts, sameStoreBundles] = await Promise.all([
    Coupon.find({ store: store._id, isActive: true }).sort({ isFeatured: -1, sortOrder: 1 }).limit(1).lean(),
    Product.find({ store: store._id, isActive: true, _id: { $ne: doc._id } })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    Bundle.find({ store: store._id, isActive: true, _id: { $ne: doc._id } })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
  ]);

  let related: CatalogItem[] = [
    ...sameStoreBundles.map((b) => ({ kind: "bundle" as const, data: serialize<BundleCard>(b) })),
    ...sameStoreProducts.map((p) => ({ kind: "product" as const, data: serialize<ProductCard>(p) })),
  ].slice(0, 8);

  if (related.length < 8 && store.categories && store.categories.length > 0) {
    const excludeIds = [doc._id, ...related.map((r) => r.data._id)];
    const storesInCategory = await Store.find(
      { categories: { $in: store.categories }, isActive: true, _id: { $ne: store._id } },
      "_id"
    ).lean();
    const storeIds = storesInCategory.map((s) => s._id);
    const extra = await Product.find({ store: { $in: storeIds }, isActive: true, _id: { $nin: excludeIds } })
      .sort({ createdAt: -1 })
      .limit(8 - related.length)
      .lean();
    related = [...related, ...extra.map((p) => ({ kind: "product" as const, data: serialize<ProductCard>(p) }))];
  }

  const storeRef = { _id: String(store._id), name: store.name, slug: store.slug, logo: store.logo, websiteUrl: store.websiteUrl };

  // Not type-annotated as CatalogDetail here — these are raw Mongoose lean
  // docs (ObjectId/Date fields, not yet JSON-safe), so it's serialized into
  // that shape below instead of being asserted to already match it.
  const item = productDoc
    ? {
        kind: "product",
        _id: String(productDoc._id),
        name: productDoc.name,
        slug: productDoc.slug,
        description: productDoc.description,
        image: productDoc.image,
        price: productDoc.price,
        originalPrice: productDoc.originalPrice,
        url: productDoc.productUrl,
        store: storeRef,
        storeCoupon: coupons[0] ?? null,
      }
    : {
        kind: "bundle",
        _id: String(bundleDoc!._id),
        name: bundleDoc!.name,
        slug: bundleDoc!.slug,
        description: bundleDoc!.description,
        image: bundleDoc!.image,
        price: bundleDoc!.price,
        originalPrice: bundleDoc!.originalPrice,
        extraDiscountPercent: bundleDoc!.extraDiscountPercent,
        url: bundleDoc!.bundleUrl,
        detailsUrl: bundleDoc!.bundleDetailsUrl,
        store: storeRef,
        storeCoupon: coupons[0] ?? null,
      };

  return {
    item: serialize<CatalogDetail>(item),
    relatedItems: related,
  };
}
