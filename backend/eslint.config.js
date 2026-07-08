const tseslint = require("typescript-eslint");

module.exports = [
  {
    ignores: ["dist/**", "coverage/**", "eslint.config.js"]
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-extraneous-class": "off"
    }
  }
];
