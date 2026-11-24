import { RESEARCH_CATEGORIES } from "@monocoupon/validation";
import type { StoreCheckView } from "./types";

/** Keyword hints per category, matched against the store's own text (word starts only). Order = priority for ties. */
const HINTS: Record<(typeof RESEARCH_CATEGORIES)[number], string[]> = {
  Supplements: ["supplement", "protein", "creatine", "vitamin", "whey", "nutrition", "amino", "pre-workout", "collagen", "probiotic"],
  "Health & Wellness": ["wellness", "health", "sleep", "immune", "organic", "natural", "herbal", "detox", "mushroom"],
  "Beauty & Skincare": ["skincare", "skin care", "beauty", "makeup", "cosmetic", "serum", "moisturi", "haircare", "fragrance", "perfume"],
  Electronics: ["electronic", "gadget", "headphone", "speaker", "camera", "laptop", "charger", "smart home", "phone case"],
  "Home & Kitchen": ["kitchen", "cookware", "furniture", "bedding", "mattress", "decor", "appliance", "home essentials", "candle"],
  Fashion: ["fashion", "apparel", "clothing", "menswear", "womenswear", "dress", "shirt", "shoe", "footwear", "denim", "jacket", "blazer"],
  Fitness: ["fitness", "gym", "workout", "yoga", "activewear", "athletic", "training", "exercise"],
  "Pet Products": ["pet supplies", "dog", "cats", "puppy", "kitten", "litter", "pets"],
  "Baby Products": ["baby", "infant", "toddler", "nursery", "stroller", "diaper"],
  Lifestyle: ["lifestyle", "gift", "stationery", "journal"],
  "Food & Drink": ["coffee", "tea", "snack", "chocolate", "beverage", "gourmet", "grocery", "wine", "drink"],
  "Jewelry & Accessories": ["jewelry", "jewellery", "watch", "wallet", "bracelet", "necklace", "accessor", "handbag", "sunglasses"],
  "Outdoor & Travel": ["outdoor", "camping", "hiking", "travel", "luggage", "backpack", "tent", "adventure"],
};

/**
 * The category shown for a store: the one saved on it, else a best guess from
 * its title, description and product names. Returns null when nothing matches
 * (shown as "Uncategorised") rather than guessing wildly.
 */
export function categoryOf(c: Pick<StoreCheckView, "category" | "identity" | "products" | "name" | "domain">): string | null {
  if (c.category) return c.category;
  const text = ` ${[c.name, c.domain, c.identity?.title, c.identity?.description, ...(c.products?.top.slice(0, 8).map((p) => p.name) ?? [])].filter(Boolean).join(" ")} `.toLowerCase();
  let best: string | null = null;
  let bestHits = 0;
  for (const cat of RESEARCH_CATEGORIES) {
    const hits = HINTS[cat].reduce((n, k) => n + (text.includes(k) ? 1 : 0), 0);
    if (hits > bestHits) {
      best = cat;
      bestHits = hits;
    }
  }
  return best;
}
