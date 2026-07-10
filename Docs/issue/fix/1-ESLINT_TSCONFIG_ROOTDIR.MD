# ESLINT_TSCONFIG_ROOTDIR

## 1. 现象

项目包含 `backend` 和 `frontend` 两个 TypeScript workspace。当前 ESLint 配置未显式指定 `tsconfigRootDir`，在从根目录或编辑器 lint 当前文件时，TypeScript parser 可能无法明确使用对应 workspace 的 `tsconfig.json`。

## 2. 修复目标

- `backend/eslint.config.js` 显式使用 `backend/tsconfig.json`。
- `frontend/eslint.config.js` 显式使用 `frontend/tsconfig.json`。
- 保持现有 lint 规则与 workspace 边界不变。

## 3. 修复动作

- 在 `backend/eslint.config.js` 的 TypeScript 文件配置块中新增 `languageOptions.parserOptions.project = "./tsconfig.json"`。
- 在 `backend/eslint.config.js` 中使用 CommonJS `__dirname` 作为 `tsconfigRootDir`，确保 backend lint 使用 `backend/tsconfig.json`。
- 在 `frontend/eslint.config.js` 中通过 `fileURLToPath(import.meta.url)` 和 `dirname()` 计算 frontend 配置目录。
- 在 `frontend/eslint.config.js` 的 TypeScript/TSX 文件配置块中新增 `languageOptions.parserOptions.project = "./tsconfig.json"` 与 `tsconfigRootDir`，确保 frontend lint 使用 `frontend/tsconfig.json`。

## 4. 验证结果

已通过：
- `npm run lint`
- `npm run typecheck`
- `npm run test`
