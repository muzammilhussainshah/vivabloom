import dotenv from "dotenv";
import path from "node:path";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "./connect";
import {
  User,
  Category,
  Store,
  DEFAULT_STORE_FAQS,
  Coupon,
  BlogPost,
  getSiteSettings,
} from "./models/index";

// Loaded relative to this file so the script works regardless of the cwd it's invoked from.
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env.local"), override: true });

function fillFaqs(storeName: string) {
  return DEFAULT_STORE_FAQS.map((faq) => ({
    question: faq.question.replaceAll("{{store}}", storeName),
    answer: faq.answer.replaceAll("{{store}}", storeName),
    sortOrder: faq.sortOrder,
  }));
}

async function seed() {
  await connectToDatabase();
  console.log("Connected. Clearing existing seed collections...");

  await Promise.all([
    Category.deleteMany({}),
    Store.deleteMany({}),
    Coupon.deleteMany({}),
    BlogPost.deleteMany({}),
  ]);

  // Categories are shared between stores and blog posts — Travel below is
  // used by both the Wanderway store AND the hotel-deals blog post.
  const [electronics, fashion, travel, lifestyle] = await Category.create([
    { name: "Electronics", slug: "electronics", description: "Gadgets, computers, and accessories.", sortOrder: 0 },
    { name: "Fashion", slug: "fashion", description: "Clothing, shoes, and accessories.", sortOrder: 1 },
    { name: "Travel", slug: "travel", description: "Flights, hotels, and vacation deals.", sortOrder: 2 },
    { name: "Lifestyle", slug: "lifestyle", description: "Everyday savings tips and shopping guides.", sortOrder: 3 },
  ]);

  const [gadgetHub, styleLoft, wanderway] = await Store.create([
    {
      name: "GadgetHub",
      slug: "gadgethub",
      description:
        "GadgetHub is an online electronics retailer offering laptops, cameras, and smart home devices at competitive prices, with fast shipping and a large customer base.",
      shortDescription: "Electronics & gadgets at everyday low prices.",
      categories: [electronics._id],
      websiteUrl: "https://example-gadgethub.com",
      stats: { totalCoupons: 0, activeDeals: 0, views: 0, rating: 4.4, joinedDate: new Date("2024-01-15") },
      faqs: fillFaqs("GadgetHub"),
      isFeatured: true,
    },
    {
      name: "StyleLoft",
      slug: "styleloft",
      description:
        "StyleLoft curates modern apparel and accessories for men and women, blending seasonal trends with everyday essentials.",
      shortDescription: "Modern apparel for everyday style.",
      categories: [fashion._id],
      websiteUrl: "https://example-styleloft.com",
      stats: { totalCoupons: 0, activeDeals: 0, views: 0, rating: 4.1, joinedDate: new Date("2024-03-02") },
      faqs: fillFaqs("StyleLoft"),
    },
    {
      name: "Wanderway",
      slug: "wanderway",
      description:
        "Wanderway helps travelers book flights, hotels, and vacation packages worldwide with flexible cancellation and 24/7 support.",
      shortDescription: "Flights, hotels, and vacation packages.",
      categories: [travel._id],
      websiteUrl: "https://example-wanderway.com",
      stats: { totalCoupons: 0, activeDeals: 0, views: 0, rating: 4.6, joinedDate: new Date("2023-11-20") },
      faqs: fillFaqs("Wanderway"),
      isFeatured: true,
    },
  ]);

  const coupons = await Coupon.create([
    {
      store: gadgetHub._id,
      storeSlug: gadgetHub.slug,
      title: "20% off laptops",
      description: "Save 20% on all laptops storewide.",
      code: "LAPTOP20",
      type: "code",
      discountType: "percentage",
      discountValue: 20,
      merchantUrl: gadgetHub.websiteUrl,
      isVerified: true,
      lastCheckedAt: new Date(),
    },
    {
      store: gadgetHub._id,
      storeSlug: gadgetHub.slug,
      title: "Free shipping on orders over $50",
      description: "No code needed — discount applied automatically at checkout.",
      type: "deal",
      merchantUrl: gadgetHub.websiteUrl,
      isVerified: true,
      lastCheckedAt: new Date(),
    },
    {
      store: styleLoft._id,
      storeSlug: styleLoft.slug,
      title: "$15 off orders over $75",
      code: "STYLE15",
      type: "code",
      discountType: "fixed",
      discountValue: 15,
      merchantUrl: styleLoft.websiteUrl,
      isVerified: false,
    },
    {
      store: wanderway._id,
      storeSlug: wanderway.slug,
      title: "10% off international flights",
      code: "FLY10",
      type: "code",
      discountType: "percentage",
      discountValue: 10,
      merchantUrl: wanderway.websiteUrl,
      isExclusive: true,
      isVerified: true,
      lastCheckedAt: new Date(),
    },
  ]);

  for (const store of [gadgetHub, styleLoft, wanderway]) {
    const storeCoupons = coupons.filter((c) => String(c.store) === String(store._id));
    if (store.stats) {
      store.stats.totalCoupons = storeCoupons.length;
      store.stats.activeDeals = storeCoupons.filter((c) => c.isActive).length;
    }
    await store.save();
  }

  await BlogPost.create([
    {
      title: "5 Ways to Save More on Electronics This Year",
      slug: "5-ways-to-save-more-on-electronics-this-year",
      excerpt: "Practical tips for finding real discounts on laptops, phones, and gadgets.",
      content:
        "<h2>Introduction</h2><p>Electronics shopping doesn't have to break the bank. Here are five practical ways to save...</p><h2>Tips</h2><ol><li>Compare prices before buying</li><li>Stack storewide coupons with seasonal sales</li><li>Sign up for price-drop alerts</li><li>Check for student/military discounts</li><li>Time big purchases around known sale events</li></ol><h2>Conclusion</h2><p>A little planning goes a long way toward real savings.</p>",
      category: lifestyle._id,
      status: "published",
      publishedAt: new Date(),
      relatedStores: [gadgetHub._id],
    },
    {
      title: "Best Hotel Booking Deals to Save More Today",
      slug: "best-hotel-booking-deals-to-save-more-today",
      excerpt: "How to find genuine hotel discounts without falling for fake urgency banners.",
      content:
        "<h2>Introduction</h2><p>Booking a hotel at the right price takes a bit of strategy...</p><h2>Tips for Maximizing Savings</h2><ul><li>Book midweek when possible</li><li>Use a verified coupon code at checkout</li><li>Compare direct booking vs. third-party rates</li></ul><h2>Conclusion</h2><p>A verified code and a little patience can meaningfully cut your travel costs.</p>",
      category: travel._id,
      status: "published",
      publishedAt: new Date(),
      relatedStores: [wanderway._id],
    },
  ]);

  await getSiteSettings();

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@monocoupon.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await User.findOneAndUpdate(
    { email: adminEmail },
    { email: adminEmail, passwordHash, name: "VivaBloom Admin", role: "admin", isActive: true },
    { upsert: true, new: true }
  );

  console.log("\nSeed complete:");
  console.log(`  Categories: 4, Stores: 3, Coupons: ${coupons.length}, Blog posts: 2`);
  console.log(`  Admin login -> email: ${adminEmail}  password: ${adminPassword}`);
  console.log("  (Change SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env.local to use your own.)\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
