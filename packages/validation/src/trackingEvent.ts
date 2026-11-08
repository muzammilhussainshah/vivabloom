import { z } from "zod";

export const trackingEventSchema = z.object({
  path: z.string().max(2048),
  referrer: z.string().max(2048).optional().nullable(),
  utmSource: z.string().max(200).optional().nullable(),
  utmMedium: z.string().max(200).optional().nullable(),
  utmCampaign: z.string().max(200).optional().nullable(),
  utmTerm: z.string().max(200).optional().nullable(),
  utmContent: z.string().max(200).optional().nullable(),
  screenWidth: z.number().int().positive().max(20000).optional().nullable(),
  screenHeight: z.number().int().positive().max(20000).optional().nullable(),
  gclid: z.string().max(200).optional().nullable(),
  clientTimezone: z.string().max(100).optional().nullable(),
  fingerprintId: z.string().max(128).optional().nullable(),
  webdriver: z.boolean().optional().nullable(),
  hardwareConcurrency: z.number().int().positive().max(1024).optional().nullable(),
  deviceMemory: z.number().positive().max(1024).optional().nullable(),
  maxTouchPoints: z.number().int().min(0).max(100).optional().nullable(),
  devicePixelRatio: z.number().positive().max(100).optional().nullable(),
  viewportWidth: z.number().int().positive().max(20000).optional().nullable(),
  viewportHeight: z.number().int().positive().max(20000).optional().nullable(),
});

export type TrackingEventInput = z.infer<typeof trackingEventSchema>;
