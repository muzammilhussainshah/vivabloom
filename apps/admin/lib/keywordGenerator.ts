/**
 * Keyword generation, classification and ranking moved into
 * `@monocoupon/keywords` so the non-English generators can share them. This
 * re-export keeps the `@/lib/keywordGenerator` import path working.
 */
export * from "@monocoupon/keywords";
