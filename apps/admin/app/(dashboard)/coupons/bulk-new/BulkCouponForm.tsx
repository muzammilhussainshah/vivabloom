"use client";

import { useActionState, useEffect, useState } from "react";
import { COUPON_TEMPLATE } from "../couponTemplate";
import type { ActionState } from "../actions";

export interface StoreOption {
  id: string;
  name: string;
}

const ROW_COUNT = COUPON_TEMPLATE.length;

export function BulkCouponForm({
  action,
  storeOptions,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  storeOptions: StoreOption[];
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [storeId, setStoreId] = useState("");
  const [items, setItems] = useState("");
  const [type, setType] = useState<"code" | "deal">("deal");
  const [included, setIncluded] = useState<boolean[]>(COUPON_TEMPLATE.map(() => true));
  const [titles, setTitles] = useState<string[]>(COUPON_TEMPLATE.map((row) => row.title("", "")));
  const [touched, setTouched] = useState<boolean[]>(COUPON_TEMPLATE.map(() => false));

  const storeName = storeOptions.find((s) => s.id === storeId)?.name ?? "";

  // Regenerate any title the admin hasn't hand-edited whenever the store or
  // item descriptor changes — once they've touched a row, their wording wins.
  useEffect(() => {
    setTitles((prev) => prev.map((t, i) => (touched[i] ? t : COUPON_TEMPLATE[i].title(storeName, items))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeName, items]);

  const includedCount = included.filter(Boolean).length;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="store" className="text-sm font-medium">
          Store
        </label>
        <select
          id="store"
          name="store"
          required
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        >
          <option value="" disabled>
            Select a store…
          </option>
          {storeOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="items" className="text-sm font-medium">
          Product category <span className="text-text-muted">(optional — e.g. "Pet Items", used in the titles below)</span>
        </label>
        <input
          id="items"
          value={items}
          onChange={(e) => setItems(e.target.value)}
          placeholder="Pet Items"
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="type" value="code" checked={type === "code"} onChange={() => setType("code")} />
          Code
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="type" value="deal" checked={type === "deal"} onChange={() => setType("deal")} />
          Deal (no code)
        </label>
      </div>

      {type === "code" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="code" className="text-sm font-medium">
            Coupon code <span className="text-text-muted">(shared by every row below)</span>
          </label>
          <input
            id="code"
            name="code"
            className="rounded-base border border-border bg-surface px-3 py-2 font-mono text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="merchantUrl" className="text-sm font-medium">
          Merchant URL <span className="text-text-muted">(shared by every row below)</span>
        </label>
        <input
          id="merchantUrl"
          name="merchantUrl"
          type="url"
          required
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="affiliateUrl" className="text-sm font-medium">
          Affiliate URL <span className="text-text-muted">(optional — used instead of merchant URL if set)</span>
        </label>
        <input
          id="affiliateUrl"
          name="affiliateUrl"
          type="url"
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="expiryDate" className="text-sm font-medium">
          Expiry date <span className="text-text-muted">(optional — evergreen if blank)</span>
        </label>
        <input
          id="expiryDate"
          name="expiryDate"
          type="date"
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isVerified" />
          Verified
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isFeatured" />
          Featured
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-base border border-border p-4">
        <p className="text-sm font-medium">Coupons to create</p>
        {COUPON_TEMPLATE.map((row, i) => (
          <div key={i} className="flex flex-col gap-2 border-b border-border pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center">
            <input
              type="checkbox"
              name={`included-${i}`}
              checked={included[i]}
              onChange={(e) => setIncluded((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))}
              className="shrink-0"
            />
            <input
              name={`title-${i}`}
              value={titles[i]}
              onChange={(e) => {
                const value = e.target.value;
                setTitles((prev) => prev.map((t, idx) => (idx === i ? value : t)));
                setTouched((prev) => prev.map((t, idx) => (idx === i ? true : t)));
              }}
              disabled={!included[i]}
              className="flex-1 rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none disabled:opacity-50"
            />
            <select
              name={`discountType-${i}`}
              defaultValue={row.discountType}
              disabled={!included[i]}
              className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none disabled:opacity-50"
            >
              <option value="percentage">%</option>
              <option value="fixed">$</option>
              <option value="other">Other</option>
            </select>
            <input
              name={`discountValue-${i}`}
              type="number"
              step="0.01"
              defaultValue={row.discountValue}
              disabled={!included[i]}
              className="w-24 rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={isPending || includedCount === 0}
        className="self-start rounded-base bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
      >
        {isPending ? "Creating…" : `Create ${includedCount} Coupon${includedCount === 1 ? "" : "s"}`}
      </button>

      {state?.error && <p className="text-sm text-brand-secondary">{state.error}</p>}
    </form>
  );
}
