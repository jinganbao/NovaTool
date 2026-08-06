import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "src-tauri/**", ".pnpm-store/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser, extraFileExtensions: [".vue"] },
    },
  },
  {
    files: ["**/*.ts", "**/*.vue"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.worker,
      },
    },
    rules: {
      // 工具代码允许显式 any 的场景由开发者自行把关，不强制
      "@typescript-eslint/no-explicit-any": "off",
      // Vue 模板中自闭合标签不是硬性要求
      "vue/html-self-closing": "off",
      "vue/multi-word-component-names": "off",
      // 组件 props 使用 camelCase 是 Vue 惯例，模板属性不强制连字符
      "vue/attribute-hyphenation": "off",
      // 下划线前缀参数视为有意忽略（如 _max）
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      // 属性顺序交给 prettier/开发者习惯
      "vue/attributes-order": "off",
    },
  },
  prettier,
);
