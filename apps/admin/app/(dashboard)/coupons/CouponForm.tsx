"use client";

import { useActionState, useState } from "react";
import { AIGenerateTextButton } from "@/components/AIGenerateTextButton";
import { couponDescriptionPrompt } from "@/lib/ai/prompts";
import type { ActionState } from "./actions";

export interface StoreOption {
  id: string;
  name: string;
}

export interface CouponFormInitialData {
  store: string;
  title: string;
  description?: string;
  code?: string | null;
  type: "code" | "deal";
  discountType: "percentage" | "fixed" | "other";
  discountValue?: number | null;
  merchantUrl: string;
  affiliateUrl?: string | null;
  startDate?: string | null;
  expiryDate?: string | null;
  isActive: boolean;
  isExclusive: boolean;
  isVerified: boolean;
  isFeatured: boolean;
  sortOrder: number;
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export function CouponForm({
  action,
  storeOptions,
  initialData,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  storeOptions: StoreOption[];
  initialData?: CouponFormInitialData;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const [type, setType] = useState<"code" | "deal">(initialData?.type ?? "code");
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");

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
          defaultValue={initialData?.store ?? ""}
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
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="20% off sitewide"
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <AIGenerateTextButton
            task="couponDescription"
            getPrompt={() => couponDescriptionPrompt({ title })}
            onGenerated={setDescription}
          />
        </div>
        <textarea
          id="description"
          name="description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="type"
            value="code"
            checked={type === "code"}
            onChange={() => setType("code")}
          />
          Code
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="type"
            value="deal"
            checked={type === "deal"}
            onChange={() => setType("deal")}
          />
          Deal (no code)
        </label>
      </div>

      {type === "code" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="code" className="text-sm font-medium">
            Coupon code
          </label>
          <input
            id="code"
            name="code"
            defaultValue={initialData?.code ?? ""}
            className="rounded-base border border-border bg-surface px-3 py-2 font-mono text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="discountType" className="text-sm font-medium">
            Discount type
          </label>
          <select
            id="discountType"
            name="discountType"
            defaultValue={initialData?.discountType ?? "other"}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          >
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed amount</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="discountValue" className="text-sm font-medium">
            Discount value
          </label>
          <input
            id="discountValue"
            name="discountValue"
            type="number"
            step="0.01"
            defaultValue={initialData?.discountValue ?? ""}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="merchantUrl" className="text-sm font-medium">
          Merchant URL
        </label>
        <input
          id="merchantUrl"
          name="merchantUrl"
          type="url"
          required
          defaultValue={initialData?.merchantUrl ?? ""}
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
          defaultValue={initialData?.affiliateUrl ?? ""}
          className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="startDate" className="text-sm font-medium">
            Start date <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={toDateInputValue(initialData?.startDate)}
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
            defaultValue={toDateInputValue(initialData?.expiryDate)}
            className="rounded-base border border-border bg-surface px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={initialData?.isActive ?? true} />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isVerified" defaultChecked={initialData?.isVerified ?? false} />
          Verified
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isExclusive" defaultChecked={initialData?.isExclusive ?? false} />
          Exclusive
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
