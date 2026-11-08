"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { verifyTurnstile } from "@/lib/turnstile";

export async function authenticate(_prevState: string | undefined, formData: FormData) {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const rate = await checkRateLimit(`login:${ip}`, { name: "login", requests: 5, window: "5 m" });
  if (!rate.allowed) {
    return "Too many sign-in attempts. Please try again in a few minutes.";
  }

  const turnstileToken = formData.get("cf-turnstile-response");
  const verified = await verifyTurnstile(typeof turnstileToken === "string" ? turnstileToken : null, ip);
  if (!verified) {
    return "Verification failed. Please try again.";
  }

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Invalid email or password.";
    }
    throw error;
  }
}
