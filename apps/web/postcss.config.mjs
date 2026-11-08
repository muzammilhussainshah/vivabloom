// Plugins are named as strings rather than imported: Next/Turbopack bundles
// this config file, and importing @tailwindcss/postcss directly drags in
// Lightning CSS's native .node binary, which cannot be bundled. Naming them
// lets Next resolve each plugin itself at build time instead — which is also
// why the local plugin lives in @monocoupon/config and is referenced by
// package specifier: a relative path here resolves against the bundled chunk,
// not against this file.
//
// Order matters — flatten-layers has to run after Tailwind has emitted its
// cascade layers. See packages/config/postcss-flatten-layers.cjs for why we
// strip them.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    "@monocoupon/config/postcss-flatten-layers": {},
  },
};

export default config;
