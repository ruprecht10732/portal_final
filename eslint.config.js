// @ts-check
import eslint from "@eslint/js";
import { config, configs } from "typescript-eslint";
import { configs as angularConfigs, processInlineTemplates } from "angular-eslint";

export default config(
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
