import { z } from "zod";

export const blogViewEventSchema = z.object({
  type: z.enum(["blog", "category"]),
  // Blog slug (type "blog") or Category ObjectId string (type "category").
  id: z.string().min(1).max(100),
});

export type BlogViewEventInput = z.infer<typeof blogViewEventSchema>;
