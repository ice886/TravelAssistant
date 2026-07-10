import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import tseslint from "typescript-eslint";

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: ["dist/**", "coverage/**"]
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
];
