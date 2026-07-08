import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["dist/**", "coverage/**"]
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
];
