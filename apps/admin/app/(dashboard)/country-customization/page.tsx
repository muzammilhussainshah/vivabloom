import type { Metadata } from "next";
import { connectToDatabase, Store, Coupon, Product, Bundle } from "@monocoupon/db";
import { SUPPORTED_COUNTRIES, isSupportedCountry, getSupportedCountry } from "@monocoupon/validation";
import { StoreCountrySelectors } from "./StoreCountrySelectors";
import { CountryCustomizationForm, type LocaleOfferData, type CouponRow, type ProductRow, type BundleRow } from "./CountryCustomizationForm";
import { saveCountryContent } from "./actions";
import type { StoreOfferFormData, FaqField } from "../stores/StoreForm";

export const metadata: Metadata = { title: "Country Customization" };

const EMPTY_LOCALE: LocaleOfferData = {
  mechanic: "",
  code: "",
  affiliateUrl: "",
  discountLabel: "",
  discountSuffix: "",
  offerSubline: "",
  lede: "",
  verifiedDate: "",
  nextCheckDate: "",
  verifierName: "",
  usageCount: "",
  trustChecks: [],
  notOffered: [],
  faqs: [],
  metaTitle: "",
  metaDescription: "",
};

/** Formats a Mongo Date (or undefined) as yyyy-mm-dd for <input type="date">. */
function toDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export default async function CountryCustomizationPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; country?: string }>;
}) {
  const { store: storeParam, country: countryParam } = await searchParams;
  const country = countryParam && isSupportedCountry(countryParam) ? countryParam : "";

  await connectToDatabase();
  const allStores = await Store.find({}, "name").sort({ name: 1 }).lean();
  const storeOptions = allStores.map((s) => ({ id: String(s._id), name: s.name }));

  const selectedStore = storeParam && storeOptions.some((s) => s.id === storeParam) ? storeParam : "";

  let englishOffer: StoreOfferFormData | null = null;
  let englishFaqs: FaqField[] = [];
  let initialLocale: LocaleOfferData = EMPTY_LOCALE;
  let coupons: CouponRow[] = [];
  let products: ProductRow[] = [];
  let bundles: BundleRow[] = [];
  let storeName = "";

  if (selectedStore && country) {
    const store = await Store.findById(selectedStore).lean();
    if (store) {
      storeName = store.name;
      englishOffer = {
        mechanic: (store.offer?.mechanic as "" | "link" | "code" | "popup") ?? "",
        code: store.offer?.code ?? "",
        affiliateUrl: store.offer?.affiliateUrl ?? "",
        discountLabel: store.offer?.discountLabel ?? "",
        discountSuffix: store.offer?.discountSuffix ?? "",
        offerSubline: store.offer?.offerSubline ?? "",
        lede: store.offer?.lede ?? "",
        verifiedDate: toDateInput(store.offer?.verifiedDate),
        nextCheckDate: toDateInput(store.offer?.nextCheckDate),
        verifierName: store.offer?.verifierName ?? "",
        usageCount: store.offer?.usageCount ?? "",
        trustChecks: store.offer?.trustChecks ?? [],
        notOffered: store.offer?.notOffered ?? [],
        proofScreenshots: store.offer?.proofScreenshots ?? [],
      };
      englishFaqs = (store.faqs ?? []).map((f) => ({ question: f.question, answer: f.answer }));

      const existing = (store.i18n ?? []).find((e) => e.country === country);
      initialLocale = existing
        ? {
            mechanic: (existing.mechanic as "" | "link" | "code" | "popup") ?? "",
            code: existing.code ?? "",
            affiliateUrl: existing.affiliateUrl ?? "",
            discountLabel: existing.discountLabel ?? "",
            discountSuffix: existing.discountSuffix ?? "",
            offerSubline: existing.offerSubline ?? "",
            lede: existing.lede ?? "",
            verifiedDate: toDateInput(existing.verifiedDate),
            nextCheckDate: toDateInput(existing.nextCheckDate),
            verifierName: existing.verifierName ?? "",
            usageCount: existing.usageCount ?? "",
            trustChecks: existing.trustChecks ?? [],
            notOffered: existing.notOffered ?? [],
            faqs: (existing.faqs ?? []).map((f) => ({ question: f.question, answer: f.answer })),
            metaTitle: existing.metaTitle ?? "",
            metaDescription: existing.metaDescription ?? "",
          }
        : EMPTY_LOCALE;

      const activeCoupons = await Coupon.find({ store: selectedStore, isActive: true }).sort({ isFeatured: -1, sortOrder: 1 }).lean();
      coupons = activeCoupons.map((c) => {
        const localeEntry = (c.i18n ?? []).find((e) => e.country === country);
        return {
          id: String(c._id),
          title: c.title,
          description: c.description ?? "",
          code: c.code ?? "",
          affiliateUrl: c.affiliateUrl ?? "",
          localeTitle: localeEntry?.title ?? "",
          localeDescription: localeEntry?.description ?? "",
          localeCode: localeEntry?.code ?? "",
          localeAffiliateUrl: localeEntry?.affiliateUrl ?? "",
        };
      });

      const activeProducts = await Product.find({ store: selectedStore, isActive: true }).lean();
      products = activeProducts.map((p) => {
        const localeEntry = (p.i18n ?? []).find((e) => e.country === country);
        return {
          id: String(p._id),
          name: p.name,
          productUrl: p.productUrl,
          localeProductUrl: localeEntry?.productUrl ?? "",
        };
      });

      const activeBundles = await Bundle.find({ store: selectedStore, isActive: true }).lean();
      bundles = activeBundles.map((b) => {
        const localeEntry = (b.i18n ?? []).find((e) => e.country === country);
        return {
          id: String(b._id),
          name: b.name,
          bundleUrl: b.bundleUrl,
          bundleDetailsUrl: b.bundleDetailsUrl,
          localeBundleUrl: localeEntry?.bundleUrl ?? "",
          localeBundleDetailsUrl: localeEntry?.bundleDetailsUrl ?? "",
        };
      });
    }
  }

  const action = saveCountryContent.bind(null, selectedStore, country);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Country Customization</h1>
      <p className="text-sm text-text-muted">
        Author country-specific overrides for a store&rsquo;s offer and coupons. Everything here is optional and falls
        back to the English content shown next to each field until you fill something in.
      </p>

      <StoreCountrySelectors stores={storeOptions} countries={SUPPORTED_COUNTRIES} currentStore={selectedStore} currentCountry={country} />

      {!selectedStore || !country ? (
        <p className="rounded-base border border-border bg-surface p-4 text-sm text-text-muted">
          Select a store and a language above to get started.
        </p>
      ) : englishOffer ? (
        <CountryCustomizationForm
          key={`${selectedStore}-${country}`}
          action={action}
          countryName={`${storeName} — ${getSupportedCountry(country)?.countryName ?? country}`}
          englishOffer={englishOffer}
          englishFaqs={englishFaqs}
          initialLocale={initialLocale}
          coupons={coupons}
          products={products}
          bundles={bundles}
        />
      ) : (
        <p className="rounded-base border border-border bg-surface p-4 text-sm text-brand-secondary">Store not found.</p>
      )}
    </div>
  );
}
