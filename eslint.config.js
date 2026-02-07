// @ts-check
import eslint from "@eslint/js";
import { config, configs } from "typescript-eslint";
import { configs as angularConfigs, processInlineTemplates } from "angular-eslint";

export default config(
  {
    ignores: [".angular/**", "report/**", "dist/**"],
  },
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...configs.recommended,
      ...configs.stylistic,
      ...angularConfigs.tsRecommended,
    ],
    processor: processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      ...angularConfigs.templateRecommended,
      ...angularConfigs.templateAccessibility,
    ],
    rules: {},
  }
);
