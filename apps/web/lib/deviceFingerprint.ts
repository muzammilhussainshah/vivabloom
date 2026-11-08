// Cookieless device fingerprint: a SHA-256 hash of stable, permissionless
// browser/hardware characteristics. Unlike the mc_did cookie it survives
// cookie clearing and incognito windows, so one machine pretending to be
// many "new" visitors collapses back into a single identity in the fraud
// scorer. No permission prompts, nothing visible, never blocks the page.
//
// Caveat: identical hardware/software combos (e.g. two factory-default
// iPhones of the same model) can share a fingerprint, so it's a fraud
// *signal* to weigh, never proof on its own.

let cached: Promise<string | null> | null = null;

async function compute(): Promise<string | null> {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const parts: (string | number)[] = [
      navigator.userAgent,
      (navigator.languages ?? []).join(","),
      navigator.platform ?? "",
      screen.width,
      screen.height,
      screen.colorDepth,
      window.devicePixelRatio ?? 1,
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
      navigator.hardwareConcurrency ?? -1,
      nav.deviceMemory ?? -1,
      navigator.maxTouchPoints ?? -1,
    ];

    // GPU identity — high entropy, differs across machines with identical UAs.
    try {
      const gl = document.createElement("canvas").getContext("webgl");
      const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
      if (gl && dbg) {
        parts.push(
          String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)),
          String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
        );
      }
    } catch {
      // WebGL unavailable — fingerprint still works from the other parts.
    }

    // Canvas rendering hash — font stack + rasterizer differences.
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 60;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "14px Arial";
        ctx.fillStyle = "#f60";
        ctx.fillRect(120, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("VivaBloom fp \u{1F9FE}", 2, 15);
        parts.push(canvas.toDataURL());
      }
    } catch {
      // Canvas blocked — proceed without it.
    }

    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts.join("|")));
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

/** Computed once per page load and reused for every beacon. */
export function getDeviceFingerprint(): Promise<string | null> {
  cached ??= compute();
  return cached;
}
