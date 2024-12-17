// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["./packages/**/src/**/*.{ts,tsx}"],
    plugins: {
      react: react,
      "react-hook": reactHooks,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
    },
  },
];
