import { z } from "zod";

export const contactMessageSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Enter a valid email address").max(320),
  phone: z.string().max(50).optional().nullable(),
  message: z.string().min(1, "Message is required").max(5000),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
