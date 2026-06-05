import next from "eslint-config-next";

// eslint-config-next 16 ships a native flat config (core-web-vitals +
// typescript + sensible ignores), so we consume it directly — no FlatCompat.
const eslintConfig = [
  ...next,
  { ignores: [".next/**", "node_modules/**"] },
  {
    // Next 16 turns on the new React-Compiler-era react-hooks advisories. Our
    // intentional, idiomatic patterns (hydrating from localStorage on mount,
    // seeding dialog form state when it opens, defaulting a selection once data
    // loads) trip these. Keep them as warnings — visible, but not build-failing.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default eslintConfig;
