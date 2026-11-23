// Reads the WebGL vendor/renderer strings for lib/deviceFingerprint.ts off
// the main thread. Creating the first WebGL context of a page blocks its
// thread while the browser brings up the GPU channel (~200ms+ on a cold
// mobile load), so doing it here keeps that out of Total Blocking Time.
// Plain JS in public/ because the CSP only allows `worker-src 'self'`.
self.onmessage = function () {
  var result = null;
  try {
    var gl = new OffscreenCanvas(1, 1).getContext("webgl");
    var dbg = gl && gl.getExtension("WEBGL_debug_renderer_info");
    if (gl && dbg) {
      result = [String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)), String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))];
    }
  } catch {
    result = null;
  }
  self.postMessage({ ok: true, gpu: result });
};
