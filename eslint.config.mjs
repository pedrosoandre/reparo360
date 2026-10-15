/**
 * ESLint 9 flat config. Substitui `next lint` (deprecado no Next 15, removido no 16).
 * Usa FlatCompat pra reaproveitar `eslint-config-next` que ainda é legacy.
 */
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "public/**",
      "next-env.d.ts",
      "tsconfig.tsbuildinfo",
      "*.log",
    ],
  },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // O projeto usa Image do next em quase tudo; libera <img> quando faz sentido.
      "@next/next/no-img-element": "warn",
      // Aspas curvas em texto pt-BR renderizam bem — regra é ruído.
      "react/no-unescaped-entities": "off",
    },
  },
];
