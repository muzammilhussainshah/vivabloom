/**
 * Verifies a Cloudflare Turnstile token server-side. Returns true (fail-open)
 * if TURNSTILE_SECRET_KEY isn't set yet, so the contact form isn't blocked
 * before that's configured — but logs a warning since it should be
 * bot-protected in real use. The client widget itself only renders when the
 * matching public site key is set.
 */
export async function verifyTurnstile(token: string | null, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn("TURNSTILE_SECRET_KEY not set — the contact form is not bot-protected");
    return true;
  }
  if (!token) return false;

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });

  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}
