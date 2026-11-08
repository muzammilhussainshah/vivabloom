"use client";

import { useActionState, useState } from "react";
import type { StoreOfferFormData, FaqField } from "../stores/StoreForm";
import type { ActionState } from "./actions";

export interface LocaleOfferData {
  mechanic: "" | "link" | "code" | "popup";
  code: string;
  affiliateUrl: string;
  discountLabel: string;
  discountSuffix: string;
  offerSubline: string;
  lede: string;
  verifiedDate: string;
  nextCheckDate: string;
  verifierName: string;
  usageCount: string;
  trustChecks: string[];
  notOffered: string[];
  faqs: FaqField[];
  metaTitle: string;
  metaDescription: string;
}

export interface CouponRow {
  id: string;
  title: string;
  description: string;
  code: string;
  affiliateUrl: string;
  /** This coupon's existing override for the selected country, if any. */
  localeTitle: string;
  localeDescription: string;
  localeCode: string;
  localeAffiliateUrl: string;
}

export interface ProductRow {
  id: string;
  name: string;
  productUrl: string;
  localeProductUrl: string;
}

export interface BundleRow {
  id: string;
  name: string;
  bundleUrl: string;
  bundleDetailsUrl: string;
  localeBundleUrl: string;
  localeBundleDetailsUrl: string;
}

const inputClass = "rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none";

/** Small muted line showing the current English value as reference — never editable here (English lives on the Stores/Coupons pages). */
function EnglishRef({ value }: { value: string }) {
  return <p className="text-xs text-text-muted">English: {value.trim() ? <span className="italic">&ldquo;{value}&rdquo;</span> : <span className="italic">(not set)</span>}</p>;
}

/**
 * The actual editing surface for one (store, country) pair — store-level
 * offer overrides plus a per-coupon title/description override for every
 * active coupon that store has. English is shown as persistent reference
 * text next to each field (via EnglishRef), not as a placeholder that
 * disappears once you start typing — the whole point of this page over the
 * old placeholder-only approach in the Stores form.
 */
export function CountryCustomizationForm({
  action,
  countryName,
  englishOffer,
  englishFaqs,
  initialLocale,
  coupons,
  products,
  bundles,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  countryName: string;
  englishOffer: StoreOfferFormData;
  englishFaqs: FaqField[];
  initialLocale: LocaleOfferData;
  coupons: CouponRow[];
  products: ProductRow[];
  bundles: BundleRow[];
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [locale, setLocale] = useState<LocaleOfferData>(initialLocale);
  const [couponOverrides, setCouponOverrides] = useState<Record<string, { title: string; description: string; code: string; affiliateUrl: string }>>(
    Object.fromEntries(coupons.map((c) => [c.id, { title: c.localeTitle, description: c.localeDescription, code: c.localeCode, affiliateUrl: c.localeAffiliateUrl }]))
  );
  const [productOverrides, setProductOverrides] = useState<Record<string, string>>(Object.fromEntries(products.map((p) => [p.id, p.localeProductUrl])));
  const [bundleOverrides, setBundleOverrides] = useState<Record<string, { url: string; detailsUrl: string }>>(
    Object.fromEntries(bundles.map((b) => [b.id, { url: b.localeBundleUrl, detailsUrl: b.localeBundleDetailsUrl }]))
  );

  function update<K extends keyof LocaleOfferData>(key: K, value: LocaleOfferData[K]) {
    setLocale((prev) => ({ ...prev, [key]: value }));
  }
  function updateListItem(key: "trustChecks" | "notOffered", index: number, value: string) {
    setLocale((prev) => {
      const next = [...prev[key]];
      next[index] = value;
      return { ...prev, [key]: next };
    });
  }
  function addListItem(key: "trustChecks" | "notOffered", max: number) {
    setLocale((prev) => (prev[key].length >= max ? prev : { ...prev, [key]: [...prev[key], ""] }));
  }
  function removeListItem(key: "trustChecks" | "notOffered", index: number) {
    setLocale((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  }
  function updateFaq(index: number, field: "question" | "answer", value: string) {
    setLocale((prev) => {
      const next = [...prev.faqs];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, faqs: next };
    });
  }
  function updateCoupon(id: string, field: "title" | "description" | "code" | "affiliateUrl", value: string) {
    setCouponOverrides((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }
  function updateProduct(id: string, value: string) {
    setProductOverrides((prev) => ({ ...prev, [id]: value }));
  }
  function updateBundle(id: string, field: "url" | "detailsUrl", value: string) {
    setBundleOverrides((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3 rounded-base border border-border bg-surface p-4">
        <legend className="text-sm font-medium">Store offer — {countryName}</legend>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Mechanic</label>
            <EnglishRef value={englishOffer.mechanic || "(auto from top coupon)"} />
            <select value={locale.mechanic} onChange={(e) => update("mechanic", e.target.value as LocaleOfferData["mechanic"])} name="mechanic" className={inputClass}>
              <option value="">Same as English</option>
              <option value="link">Link — discount rides the referral URL</option>
              <option value="code">Code — pasted at checkout</option>
              <option value="popup">Popup — store shows its own offer</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Code</label>
            <EnglishRef value={englishOffer.code} />
            <input name="code" value={locale.code} onChange={(e) => update("code", e.target.value)} className={`${inputClass} font-mono`} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Affiliate URL override</label>
          <EnglishRef value={englishOffer.affiliateUrl} />
          <input name="affiliateUrl" type="url" value={locale.affiliateUrl} onChange={(e) => update("affiliateUrl", e.target.value)} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Discount label</label>
            <EnglishRef value={englishOffer.discountLabel} />
            <input name="discountLabel" value={locale.discountLabel} onChange={(e) => update("discountLabel", e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Discount suffix</label>
            <EnglishRef value={englishOffer.discountSuffix} />
            <input name="discountSuffix" value={locale.discountSuffix} onChange={(e) => update("discountSuffix", e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Offer subline</label>
          <EnglishRef value={englishOffer.offerSubline} />
          <input name="offerSubline" value={locale.offerSubline} onChange={(e) => update("offerSubline", e.target.value)} className={inputClass} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Hero paragraph (lede)</label>
          <EnglishRef value={englishOffer.lede} />
          <textarea name="lede" rows={2} value={locale.lede} onChange={(e) => update("lede", e.target.value)} className={inputClass} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Verified date</label>
            <EnglishRef value={englishOffer.verifiedDate} />
            <input name="verifiedDate" type="date" value={locale.verifiedDate} onChange={(e) => update("verifiedDate", e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Next check date</label>
            <EnglishRef value={englishOffer.nextCheckDate} />
            <input name="nextCheckDate" type="date" value={locale.nextCheckDate} onChange={(e) => update("nextCheckDate", e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Verified by</label>
            <EnglishRef value={englishOffer.verifierName || "VivaBloom Team"} />
            <input name="verifierName" value={locale.verifierName} onChange={(e) => update("verifierName", e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Usage line</label>
          <EnglishRef value={englishOffer.usageCount} />
          <input name="usageCount" value={locale.usageCount} onChange={(e) => update("usageCount", e.target.value)} className={inputClass} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Trust row (up to 4)</label>
            <button type="button" onClick={() => addListItem("trustChecks", 4)} disabled={locale.trustChecks.length >= 4} className="rounded-base border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-muted disabled:opacity-50">
              + Add
            </button>
          </div>
          {englishOffer.trustChecks.length > 0 && (
            <p className="text-xs text-text-muted">English: {englishOffer.trustChecks.join(" · ")}</p>
          )}
          {locale.trustChecks.map((check, i) => (
            <div key={i} className="flex gap-2">
              <input name="trustCheck" value={check} onChange={(e) => updateListItem("trustChecks", i, e.target.value)} className={`flex-1 ${inputClass}`} />
              <button type="button" onClick={() => removeListItem("trustChecks", i)} className="text-xs text-brand-secondary hover:underline">
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              What this store does <em>not</em> offer (up to 4)
            </label>
            <button type="button" onClick={() => addListItem("notOffered", 4)} disabled={locale.notOffered.length >= 4} className="rounded-base border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-muted disabled:opacity-50">
              + Add
            </button>
          </div>
          {englishOffer.notOffered.length > 0 && (
            <p className="text-xs text-text-muted">English: {englishOffer.notOffered.join(" · ")}</p>
          )}
          {locale.notOffered.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input name="notOffered" value={item} onChange={(e) => updateListItem("notOffered", i, e.target.value)} className={`flex-1 ${inputClass}`} />
              <button type="button" onClick={() => removeListItem("notOffered", i)} className="text-xs text-brand-secondary hover:underline">
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">FAQs (override)</label>
            <button
              type="button"
              onClick={() => setLocale((prev) => ({ ...prev, faqs: [...prev.faqs, { question: "", answer: "" }] }))}
              className="rounded-base border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-muted"
            >
              + Add FAQ
            </button>
          </div>
          {englishFaqs.length > 0 && (
            <div className="flex flex-col gap-1 rounded-base bg-surface-muted p-2.5 text-xs text-text-muted">
              {englishFaqs.map((f, i) => (
                <p key={i}>
                  <strong>Q:</strong> {f.question} <strong>A:</strong> {f.answer}
                </p>
              ))}
            </div>
          )}
          {locale.faqs.map((faq, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-base border border-border bg-surface p-3">
              <input name="faqQuestion" value={faq.question} onChange={(e) => updateFaq(i, "question", e.target.value)} placeholder="Question" className={inputClass} />
              <textarea name="faqAnswer" value={faq.answer} onChange={(e) => updateFaq(i, "answer", e.target.value)} placeholder="Answer" rows={2} className={inputClass} />
              <button
                type="button"
                onClick={() => setLocale((prev) => ({ ...prev, faqs: prev.faqs.filter((_, idx) => idx !== i) }))}
                className="self-start text-xs text-brand-secondary hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Meta title</label>
            <input name="metaTitle" value={locale.metaTitle} onChange={(e) => update("metaTitle", e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Meta description</label>
            <input name="metaDescription" value={locale.metaDescription} onChange={(e) => update("metaDescription", e.target.value)} className={inputClass} />
          </div>
        </div>
      </fieldset>

      {coupons.length > 0 && (
        <fieldset className="flex flex-col gap-3 rounded-base border border-border bg-surface p-4">
          <div>
            <legend className="text-sm font-medium">Coupons — {countryName}</legend>
            <p className="text-xs text-text-muted">
              This store has {coupons.length} active coupon{coupons.length === 1 ? "" : "s"}. Anything left blank keeps
              showing the English title/description/code/link below.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {coupons.map((c) => (
              <div key={c.id} className="flex flex-col gap-2 rounded-base border border-border p-3">
                <EnglishRef value={c.title} />
                <input
                  name={`coupon_${c.id}_title`}
                  value={couponOverrides[c.id]?.title ?? ""}
                  onChange={(e) => updateCoupon(c.id, "title", e.target.value)}
                  placeholder="Translated title"
                  className={inputClass}
                />
                {c.description && <EnglishRef value={c.description} />}
                <textarea
                  name={`coupon_${c.id}_description`}
                  value={couponOverrides[c.id]?.description ?? ""}
                  onChange={(e) => updateCoupon(c.id, "description", e.target.value)}
                  placeholder="Translated description"
                  rows={2}
                  className={inputClass}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <EnglishRef value={c.code} />
                    <input
                      name={`coupon_${c.id}_code`}
                      value={couponOverrides[c.id]?.code ?? ""}
                      onChange={(e) => updateCoupon(c.id, "code", e.target.value)}
                      placeholder="Code override"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <EnglishRef value={c.affiliateUrl} />
                    <input
                      name={`coupon_${c.id}_affiliateUrl`}
                      type="url"
                      value={couponOverrides[c.id]?.affiliateUrl ?? ""}
                      onChange={(e) => updateCoupon(c.id, "affiliateUrl", e.target.value)}
                      placeholder="Referral link override"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      )}

      {products.length > 0 && (
        <fieldset className="flex flex-col gap-3 rounded-base border border-border bg-surface p-4">
          <div>
            <legend className="text-sm font-medium">Products — {countryName}</legend>
            <p className="text-xs text-text-muted">
              Referral link overrides only — product name/image/price stay the same everywhere. Leave blank to keep
              the English link.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {products.map((p) => (
              <div key={p.id} className="flex flex-col gap-1 rounded-base border border-border p-3">
                <p className="text-sm font-medium">{p.name}</p>
                <EnglishRef value={p.productUrl} />
                <input
                  name={`product_${p.id}_url`}
                  type="url"
                  value={productOverrides[p.id] ?? ""}
                  onChange={(e) => updateProduct(p.id, e.target.value)}
                  placeholder="Referral link override"
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </fieldset>
      )}

      {bundles.length > 0 && (
        <fieldset className="flex flex-col gap-3 rounded-base border border-border bg-surface p-4">
          <div>
            <legend className="text-sm font-medium">Bundles — {countryName}</legend>
            <p className="text-xs text-text-muted">
              Referral link overrides only. Leave blank to keep the English links.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {bundles.map((b) => (
              <div key={b.id} className="flex flex-col gap-2 rounded-base border border-border p-3">
                <p className="text-sm font-medium">{b.name}</p>
                <div className="flex flex-col gap-1">
                  <EnglishRef value={b.bundleUrl} />
                  <input
                    name={`bundle_${b.id}_url`}
                    type="url"
                    value={bundleOverrides[b.id]?.url ?? ""}
                    onChange={(e) => updateBundle(b.id, "url", e.target.value)}
                    placeholder="Bundle link override"
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <EnglishRef value={b.bundleDetailsUrl} />
                  <input
                    name={`bundle_${b.id}_detailsUrl`}
                    type="url"
                    value={bundleOverrides[b.id]?.detailsUrl ?? ""}
                    onChange={(e) => updateBundle(b.id, "detailsUrl", e.target.value)}
                    placeholder="Bundle details link override"
                    className={inputClass}
                  />
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-base bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save"}
      </button>

      {state?.error && <p className="text-sm text-brand-secondary">{state.error}</p>}
      {state?.success && <p className="text-sm text-brand-primary">Saved.</p>}
    </form>
  );
}
