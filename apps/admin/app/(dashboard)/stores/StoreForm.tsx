"use client";

import { useActionState, useState } from "react";
import { slugify } from "@/lib/slugify";
import { AIGenerateTextButton } from "@/components/AIGenerateTextButton";
import { ImageUploadButton } from "@/components/ImageUploadButton";
import { storeDescriptionPrompt } from "@/lib/ai/prompts";
import type { ActionState } from "./actions";

export interface CategoryOption {
  id: string;
  name: string;
}

export interface FaqField {
  question: string;
  answer: string;
}

export interface StoreOfferFormData {
  mechanic: "" | "link" | "code" | "popup";
  code: string;
  affiliateUrl: string;
  discountLabel: string;
  discountSuffix: string;
  offerSubline: string;
  lede: string;
  /** yyyy-mm-dd, for <input type="date">. */
  verifiedDate: string;
  nextCheckDate: string;
  verifierName: string;
  usageCount: string;
  trustChecks: string[];
  notOffered: string[];
  proofScreenshots: string[];
}

const EMPTY_OFFER: StoreOfferFormData = {
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
  proofScreenshots: [],
};

export interface StoreFormInitialData {
  name: string;
  slug: string;
  logo?: string | null;
  description?: string;
  shortDescription?: string;
  categoryIds: string[];
  websiteUrl: string;
  faqs: FaqField[];
  offer?: StoreOfferFormData;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
  rating: number;
}

const DEFAULT_FAQ_TEMPLATES = [
  { q: "How do I use a {{store}} coupon code?", a: "Copy the code, visit {{store}}, add items to your cart, and paste the code at checkout before paying." },
  { q: "Why is my {{store}} coupon code not working?", a: "Codes can expire, be limited to certain items, or require a minimum order value. Check the coupon's terms or try another active offer." },
  { q: "Does {{store}} offer free shipping?", a: "Some {{store}} offers include free shipping. Look for deals tagged accordingly on this page." },
  { q: "Can I stack multiple {{store}} coupons?", a: "Most stores allow only one coupon code per order unless stated otherwise in the offer's terms." },
  { q: "How often are {{store}} coupons updated?", a: "We check {{store}} regularly and update this page whenever new codes or deals are found." },
  { q: "Are {{store}} coupons verified?", a: "Coupons marked as verified were confirmed working by our team on the date shown." },
  { q: "Do I need an account to use a {{store}} coupon?", a: "This depends on {{store}}'s own checkout process — most retailers allow guest checkout with a coupon applied." },
  { q: "What if a {{store}} discount isn't applying at checkout?", a: "Double-check the code was entered exactly as shown and that your cart meets the offer's conditions." },
];

export function StoreForm({
  action,
  categoryOptions,
  initialData,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  categoryOptions: CategoryOption[];
  initialData?: StoreFormInitialData;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [name, setName] = useState(initialData?.name ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [faqs, setFaqs] = useState<FaqField[]>(initialData?.faqs ?? []);
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [logo, setLogo] = useState(initialData?.logo ?? "");
  const [offer, setOffer] = useState<StoreOfferFormData>(initialData?.offer ?? EMPTY_OFFER);

  function updateOffer<K extends keyof StoreOfferFormData>(key: K, value: StoreOfferFormData[K]) {
    setOffer((prev) => ({ ...prev, [key]: value }));
  }
  function updateOfferListItem(key: "trustChecks" | "notOffered", index: number, value: string) {
    setOffer((prev) => {
      const next = [...prev[key]];
      next[index] = value;
      return { ...prev, [key]: next };
    });
  }
  function addOfferListItem(key: "trustChecks" | "notOffered", max: number) {
    setOffer((prev) => (prev[key].length >= max ? prev : { ...prev, [key]: [...prev[key], ""] }));
  }
  function removeOfferListItem(key: "trustChecks" | "notOffered", index: number) {
    setOffer((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  }
  function setProofScreenshot(index: number, url: string) {
    setOffer((prev) => {
      // Keep the array indexed by upload slot (0/1/2) — do not compact, or
      // the hidden inputs keyed by slot index below would fall out of sync
      // with what's actually displayed in each slot.
      const next = [prev.proofScreenshots[0] ?? "", prev.proofScreenshots[1] ?? "", prev.proofScreenshots[2] ?? ""];
      next[index] = url;
      return { ...prev, proofScreenshots: next };
    });
  }

  function fillStandardFaqs() {
    const storeName = name || "this store";
    setFaqs(
      DEFAULT_FAQ_TEMPLATES.map((f) => ({
        question: f.q.replaceAll("{{store}}", storeName),
        answer: f.a.replaceAll("{{store}}", storeName),
      }))
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="slug" className="text-sm font-medium">
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
          className="rounded-base border border-border bg-surface px-3 py-2 font-mono text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="websiteUrl" className="text-sm font-medium">
          Website URL
        </label>
        <input
          id="websiteUrl"
          name="websiteUrl"
          type="url"
          required
          defaultValue={initialData?.websiteUrl ?? ""}
          placeholder="https://example.com"
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor="logo" className="text-sm font-medium">
            Logo <span className="text-text-muted">(optional)</span>
          </label>
          <ImageUploadButton prefix="stores" onUploaded={setLogo} />
        </div>
        <input
          id="logo"
          name="logo"
          type="url"
          placeholder="https://example.com/logo.png, or upload one above"
          value={logo}
          onChange={(e) => setLogo(e.target.value)}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element -- preview of arbitrary/uploaded URL
          <img src={logo} alt="Logo preview" className="mt-1 h-14 w-auto max-w-48 rounded-base border border-border object-contain" />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="shortDescription" className="text-sm font-medium">
          Short description
        </label>
        <input
          id="shortDescription"
          name="shortDescription"
          defaultValue={initialData?.shortDescription ?? ""}
          maxLength={150}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor="description" className="text-sm font-medium">
            Full description
          </label>
          <AIGenerateTextButton
            task="storeDescription"
            getPrompt={() => storeDescriptionPrompt({ name })}
            onGenerated={setDescription}
          />
        </div>
        <textarea
          id="description"
          name="description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Categories</legend>
        <div className="flex flex-wrap gap-3 rounded-base border border-border bg-surface p-3">
          {categoryOptions.map((cat) => (
            <label key={cat.id} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name="categories"
                value={cat.id}
                defaultChecked={initialData?.categoryIds?.includes(cat.id)}
              />
              {cat.name}
            </label>
          ))}
          {categoryOptions.length === 0 && (
            <p className="text-sm text-text-muted">No categories yet — create one first.</p>
          )}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-medium">FAQs</legend>
          <button
            type="button"
            onClick={fillStandardFaqs}
            className="rounded-base border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-muted"
          >
            Use standard 8 FAQs
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-base border border-border bg-surface p-3">
              <input
                name="faqQuestion"
                value={faq.question}
                onChange={(e) => {
                  const next = [...faqs];
                  next[i] = { ...next[i], question: e.target.value };
                  setFaqs(next);
                }}
                placeholder="Question"
                className="rounded-base border border-border bg-surface px-2 py-1.5 text-sm focus:border-brand-primary focus:outline-none"
              />
              <textarea
                name="faqAnswer"
                value={faq.answer}
                onChange={(e) => {
                  const next = [...faqs];
                  next[i] = { ...next[i], answer: e.target.value };
                  setFaqs(next);
                }}
                placeholder="Answer"
                rows={2}
                className="rounded-base border border-border bg-surface px-2 py-1.5 text-sm focus:border-brand-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setFaqs(faqs.filter((_, idx) => idx !== i))}
                className="self-start text-xs text-brand-secondary hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setFaqs([...faqs, { question: "", answer: "" }])}
          className="self-start rounded-base border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-muted"
        >
          + Add FAQ
        </button>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-base border border-border p-4">
        <div>
          <legend className="text-sm font-medium">Store Page Offer</legend>
          <p className="text-xs text-text-muted">
            Powers the /stores/[slug] redesign&rsquo;s scratch-off voucher. Anything left blank falls back to this
            store&rsquo;s top coupon where possible — <strong>“Does not offer”</strong> falls back to generic copy
            until you write store-specific lines here. The proof screenshots are the one thing with no
            fallback — that section simply won&rsquo;t show until you upload some.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="offerMechanic" className="text-sm font-medium">
              Mechanic
            </label>
            <select
              id="offerMechanic"
              name="offerMechanic"
              value={offer.mechanic}
              onChange={(e) => updateOffer("mechanic", e.target.value as StoreOfferFormData["mechanic"])}
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            >
              <option value="">Auto (from top coupon)</option>
              <option value="link">Link — discount rides the referral URL</option>
              <option value="code">Code — pasted at checkout</option>
              <option value="popup">Popup — store shows its own offer</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="offerCode" className="text-sm font-medium">
              Code <span className="text-text-muted">(if mechanic is Code)</span>
            </label>
            <input
              id="offerCode"
              name="offerCode"
              value={offer.code}
              onChange={(e) => updateOffer("code", e.target.value)}
              className="rounded-base border border-border bg-surface px-3 py-2 font-mono text-sm focus:border-brand-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="offerAffiliateUrl" className="text-sm font-medium">
            Affiliate URL override <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="offerAffiliateUrl"
            name="offerAffiliateUrl"
            type="url"
            value={offer.affiliateUrl}
            onChange={(e) => updateOffer("affiliateUrl", e.target.value)}
            placeholder="Falls back to the top coupon's link, then the website URL"
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="offerDiscountLabel" className="text-sm font-medium">
              Discount label <span className="text-text-muted">(e.g. "$80")</span>
            </label>
            <input
              id="offerDiscountLabel"
              name="offerDiscountLabel"
              value={offer.discountLabel}
              onChange={(e) => updateOffer("discountLabel", e.target.value)}
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="offerDiscountSuffix" className="text-sm font-medium">
              Discount suffix <span className="text-text-muted">(e.g. "off {name || "Store"}")</span>
            </label>
            <input
              id="offerDiscountSuffix"
              name="offerDiscountSuffix"
              value={offer.discountSuffix}
              onChange={(e) => updateOffer("discountSuffix", e.target.value)}
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="offerSubline" className="text-sm font-medium">
            Offer subline <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="offerSubline"
            name="offerSubline"
            value={offer.offerSubline}
            onChange={(e) => updateOffer("offerSubline", e.target.value)}
            placeholder="Site-wide, on top of prices already reduced"
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="offerLede" className="text-sm font-medium">
            Hero paragraph (lede){" "}
            <span className="text-text-muted">(optional, desktop only — a generic templated line is used until you override it)</span>
          </label>
          <textarea
            id="offerLede"
            name="offerLede"
            rows={2}
            value={offer.lede}
            onChange={(e) => updateOffer("lede", e.target.value)}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="offerVerifiedDate" className="text-sm font-medium">
              Verified date
            </label>
            <input
              id="offerVerifiedDate"
              name="offerVerifiedDate"
              type="date"
              value={offer.verifiedDate}
              onChange={(e) => updateOffer("verifiedDate", e.target.value)}
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="offerNextCheckDate" className="text-sm font-medium">
              Next check date
            </label>
            <input
              id="offerNextCheckDate"
              name="offerNextCheckDate"
              type="date"
              value={offer.nextCheckDate}
              onChange={(e) => updateOffer("nextCheckDate", e.target.value)}
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="offerVerifierName" className="text-sm font-medium">
              Verified by
            </label>
            <input
              id="offerVerifierName"
              name="offerVerifierName"
              value={offer.verifierName}
              onChange={(e) => updateOffer("verifierName", e.target.value)}
              placeholder="VivaBloom Team"
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="offerUsageCount" className="text-sm font-medium">
            Usage line <span className="text-text-muted">(optional — a real, verified sentence only; leave blank rather than guess)</span>
          </label>
          <input
            id="offerUsageCount"
            name="offerUsageCount"
            value={offer.usageCount}
            onChange={(e) => updateOffer("usageCount", e.target.value)}
            placeholder="Used 14x this week"
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              Trust row <span className="text-text-muted">(up to 4 — generic defaults are used if none set)</span>
            </label>
            <button
              type="button"
              onClick={() => addOfferListItem("trustChecks", 4)}
              disabled={offer.trustChecks.length >= 4}
              className="rounded-base border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-muted disabled:opacity-50"
            >
              + Add
            </button>
          </div>
          {offer.trustChecks.map((check, i) => (
            <div key={i} className="flex gap-2">
              <input
                name="offerTrustCheck"
                value={check}
                onChange={(e) => updateOfferListItem("trustChecks", i, e.target.value)}
                placeholder="No signup needed"
                className="flex-1 rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeOfferListItem("trustChecks", i)}
                className="text-xs text-brand-secondary hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              What this store does <em>not</em> offer <span className="text-text-muted">(up to 4 — generic defaults shown until you add your own)</span>
            </label>
            <button
              type="button"
              onClick={() => addOfferListItem("notOffered", 4)}
              disabled={offer.notOffered.length >= 4}
              className="rounded-base border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-muted disabled:opacity-50"
            >
              + Add
            </button>
          </div>
          {offer.notOffered.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input
                name="offerNotOffered"
                value={item}
                onChange={(e) => updateOfferListItem("notOffered", i, e.target.value)}
                placeholder="No stacking — one discount per order"
                className="flex-1 rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeOfferListItem("notOffered", i)}
                className="text-xs text-brand-secondary hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">
            Proof screenshots <span className="text-text-muted">(up to 3 — landing → waiting → discount at checkout; section hidden until at least one is set)</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <input type="hidden" name={`offerProofScreenshot${i}`} value={offer.proofScreenshots[i] ?? ""} />
                <ImageUploadButton label={`Screenshot ${i + 1}`} prefix="store-proof" onUploaded={(url) => setProofScreenshot(i, url)} />
                {offer.proofScreenshots[i] && (
                  // eslint-disable-next-line @next/next/no-img-element -- preview of an uploaded URL
                  <img src={offer.proofScreenshots[i]} alt={`Proof screenshot ${i + 1} preview`} className="h-20 w-full rounded-base border border-border object-cover" />
                )}
              </div>
            ))}
          </div>
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="seoTitle" className="text-sm font-medium">
            SEO title <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="seoTitle"
            name="seoTitle"
            defaultValue={initialData?.seoTitle ?? ""}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="rating" className="text-sm font-medium">
            Rating (0–5)
          </label>
          <input
            id="rating"
            name="rating"
            type="number"
            min={0}
            max={5}
            step={0.1}
            defaultValue={initialData?.rating ?? 0}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="seoDescription" className="text-sm font-medium">
          SEO description <span className="text-text-muted">(optional)</span>
        </label>
        <textarea
          id="seoDescription"
          name="seoDescription"
          rows={2}
          defaultValue={initialData?.seoDescription ?? ""}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="sortOrder" className="text-sm font-medium">
          Sort order <span className="text-text-muted">(lower shows first — controls store order on /stores and /products, after Featured)</span>
        </label>
        <input
          id="sortOrder"
          name="sortOrder"
          type="number"
          defaultValue={initialData?.sortOrder ?? 0}
          className="max-w-[140px] rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={initialData?.isActive ?? true} />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isFeatured" defaultChecked={initialData?.isFeatured ?? false} />
          Featured
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-base bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
      >
        {isPending ? "Saving…" : submitLabel}
      </button>

      {state?.error && <p className="text-sm text-brand-secondary">{state.error}</p>}
    </form>
  );
}
