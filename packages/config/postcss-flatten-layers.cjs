/*
 * PostCSS plugin: unwraps Tailwind v4's CSS cascade layers (`@layer`) from the
 * emitted stylesheet.
 *
 * Why: Tailwind v4 wraps ~70% of its output — the theme tokens, the preflight
 * reset, and every single utility class — in `@layer` blocks. Per CSS Syntax
 * Level 3, a browser that doesn't recognise an at-rule discards the at-rule
 * *and its entire block*. So on any engine older than roughly March 2022
 * (Safari < 15.4, Chrome/Edge < 99, Firefox < 97, Samsung Internet < 18,
 * Opera < 86) the whole stylesheet silently evaporates and the site renders as
 * raw unstyled HTML. It is not a graceful degradation — it is total, and it
 * cannot be polyfilled or guarded with @supports, because the browser drops the
 * rules before any feature query could run. Lightning CSS cannot downlevel
 * cascade layers either, so stripping them at build time is the only fix.
 *
 * Removing the layers is safe *for this codebase* specifically, and it is worth
 * spelling out why, because flattening layers is not universally safe:
 *
 *   1. Nothing here depends on layer-order-beats-specificity. We author no
 *      `@layer` of our own, use no `@apply`, no `!important`, and pull in no
 *      third-party CSS that would need to be ordered against Tailwind.
 *   2. Tailwind's preflight is already specificity-safe by design — every
 *      selector in it is an element or pseudo-element, with classes appearing
 *      only inside zero-specificity `:where()`. So utilities (0,1,0) still beat
 *      the reset on plain specificity once the layers are gone.
 *   3. Source order is preserved exactly. Each block is replaced in place, so
 *      the emitted order (properties -> theme -> base -> utilities) still
 *      matches the intended cascade for any same-specificity ties.
 *   4. Our own two rules (the `:root` tokens and the `body` background/colour)
 *      are emitted *after* the layer blocks, so they keep winning — previously
 *      because unlayered beats layered, now because they come last.
 *
 * Cost: none. The output is marginally *smaller* (the wrappers are bytes), it
 * is still one stylesheet and one request, and no JavaScript or feature
 * detection is involved — so there is nothing extra to block or delay the first
 * paint. Modern browsers are unaffected; they simply resolve the same rules via
 * specificity and source order instead of via layer order.
 *
 * If a future change introduces authored `@layer` blocks, `@apply`, or
 * third-party CSS that relies on layer ordering, revisit this: the cascade
 * guarantees above would no longer hold.
 *
 * CommonJS rather than ESM because Next resolves and `require()`s PostCSS
 * plugins by name at build time.
 */
const plugin = () => ({
  postcssPlugin: "flatten-cascade-layers",
  // OnceExit so this runs after Tailwind has generated its output, not before.
  OnceExit(root) {
    // Unwrapping hoists any nested `@layer` up into the parent, which can land
    // it *behind* the walker's cursor. Loop until a full pass finds none left
    // rather than trusting a single traversal to catch them all.
    let found = true;
    while (found) {
      found = false;
      root.walkAtRules("layer", (rule) => {
        found = true;
        if (rule.nodes) {
          // `@layer name { ... }` -> splice the contents in where it stood.
          rule.replaceWith(rule.nodes);
        } else {
          // `@layer a, b;` — the ordering statement. Meaningless once the
          // blocks are unwrapped, so drop it.
          rule.remove();
        }
      });
    }
  },
});

plugin.postcss = true;

module.exports = plugin;
