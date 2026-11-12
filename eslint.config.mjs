import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.next-chain/**",
      "apps/web/design/**",
      "**/coverage/**",
      "**/next-env.d.ts",
      "contracts/**",
      "sim/**",
      "docs/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // docs/07 3.2 item 5: the copilot must not reach relay, attest or wallet code (and vice versa for secrets).
    files: ["apps/web/app/api/copilot/**/*.ts", "apps/web/lib/copilot/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["**/api/relay/**", "**/api/attest/**", "**/lib/server/relay*", "**/lib/server/attest*"], message: "The copilot must not import relay or attest modules." },
            { group: ["@privy-io/*", "wagmi", "viem/accounts"], message: "The copilot has no wallet access." },
          ],
        },
      ],
    },
  },
);
