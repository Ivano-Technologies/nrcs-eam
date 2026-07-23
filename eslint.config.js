import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "drizzle/**",
      "node_modules/**",
      "patches/**",
      "docs/**",
      "scripts/**",
      "tests/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "graphify-out/**",
      "**/*.config.js",
      "**/*.config.mjs",
      "**/*.config.ts",
      "vite.config.ts",
      "vitest.config.ts",
      "vitest.setup.ts",
      "playwright.config.ts",
    ],
  },
  {
    files: ["server/**/*.{ts,tsx}", "client/src/**/*.{ts,tsx}", "shared/**/*.{ts,tsx}", "api/**/*.{ts,tsx}"],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended, eslintConfigPrettier],
    rules: {
      // 147 existing usages — warn only; do not mass-fix in Task 1
      "@typescript-eslint/no-explicit-any": "warn",
      // Existing codebase patterns — downgrade mass-error rules to warn
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/prefer-as-const": "warn",
      "@typescript-eslint/no-namespace": "warn",
      "no-useless-escape": "warn",
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "prefer-const": "warn",
      "no-case-declarations": "warn",
      "no-undef": "off", // TypeScript handles this
      "no-redeclare": "off",
      "@typescript-eslint/no-redeclare": "warn",
    },
  },
  {
    files: ["client/src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // Classic hooks rules only. React Compiler rules from plugin v7
      // (set-state-in-effect, purity, refs, etc.) fire ~50 errors on
      // existing patterns — warn until a dedicated cleanup pass.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/incompatible-library": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/component-hook-factories": "warn",
      "react-hooks/use-memo": "warn",
    },
  }
);
