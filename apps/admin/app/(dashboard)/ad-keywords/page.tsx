import type { Metadata } from "next";
import { connectToDatabase, KeywordLocale, KeywordTemplate, Store } from "@monocoupon/db";
import type { LocalePack } from "@monocoupon/keywords";
import { AdKeywordsGenerator } from "./AdKeywordsGenerator";

export const metadata: Metadata = { title: "Ad Keywords" };
export const dynamic = "force-dynamic";

/**
 * Mongoose documents carry ObjectIds and Dates that a client component cannot
 * receive, so each pack is rebuilt as a plain object of exactly the fields the
 * generator reads.
 */
function toLocalePack(doc: Record<string, unknown>): LocalePack {
  const strings = (key: string) => (Array.isArray(doc[key]) ? (doc[key] as string[]) : []);
  return {
    code: String(doc.code ?? ""),
    language: String(doc.language ?? ""),
    countries: strings("countries"),
    intentTerms: strings("intentTerms"),
    offerModifiers: strings("offerModifiers"),
    qualifierModifiers: strings("qualifierModifiers"),
    urgencyModifiers: strings("urgencyModifiers"),
    amountModifiers: strings("amountModifiers"),
    seasonalModifiers: strings("seasonalModifiers"),
    verticals: strings("verticals"),
    geoModifiers: strings("geoModifiers"),
    fillerModifiers: strings("fillerModifiers"),
    paymentModifiers: strings("paymentModifiers"),
    informationalModifiers: strings("informationalModifiers"),
    connectors: strings("connectors"),
    months: (doc.months ?? {}) as Record<string, string[]>,
    patterns: strings("patterns"),
    negativeKeywords: strings("negativeKeywords"),
    stripAccents: Boolean(doc.stripAccents),
    compoundForms: Boolean(doc.compoundForms),
  };
}

export default async function AdKeywordsPage() {
  await connectToDatabase();

  const [templates, stores, locales] = await Promise.all([
    KeywordTemplate.find({}).sort({ name: 1 }).lean(),
    Store.find({}).sort({ name: 1 }).select("name slug").lean(),
    KeywordLocale.find({}).sort({ language: 1 }).lean(),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Ad Keywords</h1>
        <p className="text-sm text-text-muted">
          Turn a base keyword list into store-specific Google Ads keywords, ready to copy and paste.
        </p>
      </div>

      <AdKeywordsGenerator
        templates={templates.map((t) => {
          const brandTokens = t.brandTokens ?? [];
          // Fall back to the shortest brand token (e.g. "tabs") when brandName
          // isn't stored yet, so existing templates keep working without a migration.
          const shortestToken = brandTokens.reduce((a, b) => (b.length < a.length ? b : a), brandTokens[0] ?? "");
          return {
            id: String(t._id),
            name: t.name,
            brandTokens,
            brandName: t.brandName || shortestToken,
            brandDescriptor: t.brandDescriptor ?? "",
            keywords: t.keywords ?? [],
            negativeKeywords: t.negativeKeywords ?? [],
          };
        })}
        stores={stores.map((s) => ({ id: String(s._id), name: s.name, slug: s.slug }))}
        locales={locales.map((l) => toLocalePack(l as unknown as Record<string, unknown>))}
      />
    </div>
  );
}
