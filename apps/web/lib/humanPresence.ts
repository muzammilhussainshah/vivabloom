// Passive human-presence detection: counts real input events (pointer
// movement, touch, keys, wheel) at the document level. Requires no
// permission, never blocks, and is invisible to the visitor. A scripted
// el.click() or CDP-dispatched click produces none of these first, so
// engagement beacons carry hasHumanActivity() to expose synthetic clicks.

let interactions = 0;

if (typeof document !== "undefined") {
  const bump = () => {
    interactions++;
  };
  const opts = { passive: true, capture: true } as const;
  document.addEventListener("pointermove", bump, opts);
  document.addEventListener("pointerdown", bump, opts);
  document.addEventListener("touchstart", bump, opts);
  document.addEventListener("keydown", bump, opts);
  document.addEventListener("wheel", bump, opts);
}

export function hasHumanActivity(): boolean {
  return interactions > 0;
}
