/**
 * Verifies a Cloudflare Turnstile token server-side. Returns true (fail-open)
 * if TURNSTILE_SECRET_KEY isn't set yet, so login isn't blocked before that's
 * configured — but logs a warning since login should be bot-protected in
 * real use. The client widget itself is only rendered when the matching
 * public site key is set, so this fail-open path only triggers if one of
 * the two keys was set without the other.
 */
export async function verifyTurnstile(token: string | null, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn("TURNSTILE_SECRET_KEY not set — login is not bot-protected");
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
