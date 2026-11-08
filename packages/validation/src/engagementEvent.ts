import { z } from "zod";

export const engagementEventSchema = z.object({
  path: z.string().max(2048),
  type: z.enum(["dwell", "scroll_depth", "affiliate_click", "coupon_copy"]),
  value: z.number().finite().optional().nullable(),
  storeSlug: z.string().max(200).optional().nullable(),
  couponId: z.string().max(100).optional().nullable(),
  couponCode: z.string().max(100).optional().nullable(),
  destinationUrl: z.string().max(2048).optional().nullable(),
  // Whether any human input (pointer move, touch, key press) happened on the
  // page before this event — synthetic bot clicks typically have none.
  hadPointer: z.boolean().optional().nullable(),
});

export type EngagementEventInput = z.infer<typeof engagementEventSchema>;
