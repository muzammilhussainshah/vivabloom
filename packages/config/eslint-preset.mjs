// Shared base rules for both apps. Each app's own eslint.config.mjs spreads
// this before its framework-specific config (e.g. eslint-config-next).
const basePreset = [
  {
    rules: {
      "no-unused-vars": "off",
      "prefer-const": "warn",
      eqeqeq: ["warn", "smart"],
    },
  },
];

export default basePreset;
