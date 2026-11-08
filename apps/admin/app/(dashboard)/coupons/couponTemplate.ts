/**
 * The 5-coupon set we repeatedly create for every new store (same shape,
 * store name — and an optional product-category phrase — swapped in). Lets
 * bulk-new pre-fill sensible titles/discounts instead of the admin typing
 * the same pattern 5 times.
 */
export interface CouponTemplateRow {
  title: (store: string, items: string) => string;
  discountType: "percentage" | "fixed" | "other";
  discountValue: number;
}

export const COUPON_TEMPLATE: CouponTemplateRow[] = [
  {
    title: () => "Get $80 Off Site-wide",
    discountType: "fixed",
    discountValue: 80,
  },
  {
    title: (store, items) => `eBay ${store}${items ? ` ${items}` : ""} - Up to 30% Off`,
    discountType: "percentage",
    discountValue: 30,
  },
  {
    title: (store, items) => `Walmart ${store} - Up to 20% Off${items ? ` ${items}` : ""}`,
    discountType: "percentage",
    discountValue: 20,
  },
  {
    title: (store, items) => `${store}${items ? ` ${items}` : ""} - 20% Off Single-Use Code`,
    discountType: "percentage",
    discountValue: 20,
  },
  {
    title: (store, items) => `${store}${items ? ` ${items}` : ""} - Up to 30% Off`,
    discountType: "percentage",
    discountValue: 30,
  },
];
