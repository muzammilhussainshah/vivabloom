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

/** Lets the browser run other work (input, paint) between steps. */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** WebGL vendor + renderer on the main thread — the original path, kept as the fallback. */
function readGpuStringsOnMainThread(): [string, string] | null {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
    if (gl && dbg) {
      return [String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)), String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))];
    }
  } catch {
    // WebGL unavailable — fingerprint still works from the other parts.
  }
  return null;
}

/**
 * Prefers public/fp-worker.js (OffscreenCanvas): the first WebGL context of a
 * page blocks its thread while the GPU channel comes up, which on the main
 * thread showed up as a ~200ms+ long task on every paid landing. Falls back to
 * the main thread when workers/OffscreenCanvas are missing or the worker
 * fails, so the fingerprint's inputs never change.
 */
function readGpuStrings(): Promise<[string, string] | null> {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
    return Promise.resolve(readGpuStringsOnMainThread());
  }
  return new Promise((resolve) => {
    let worker: Worker | undefined;
    const finish = (value: [string, string] | null) => {
      clearTimeout(timer);
      worker?.terminate();
      resolve(value);
    };
    const fallback = () => finish(readGpuStringsOnMainThread());
    const timer = setTimeout(fallback, 3000);
    try {
      worker = new Worker("/fp-worker.js");
    } catch {
      fallback();
      return;
    }
    worker.onmessage = (e: MessageEvent<{ ok: boolean; gpu: [string, string] | null }>) =>
      // No WebGL in the worker (e.g. older Safari supports OffscreenCanvas 2D
      // only): retry on the main thread so the hash matches the old one.
      e.data?.gpu ? finish(e.data.gpu) : fallback();
    worker.onerror = fallback;
    worker.postMessage(null);
  });
}

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
    // Same two strings, in the same position, as before the worker move, so
    // existing fingerprints stay stable.
    const gpu = await readGpuStrings();
    if (gpu) parts.push(gpu[0], gpu[1]);

    // Yield before the canvas draw + encode and again before hashing, so the
    // work runs as several short tasks instead of one long main-thread task
    // (anything over 50ms counts toward Total Blocking Time).
    await yieldToMain();

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

    await yieldToMain();
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
